"""
AWS Secrets Manager rotation Lambda for PostgreSQL databases.

This Lambda function implements the four-step rotation process:
1. createSecret - Generate new password and create pending version
2. setSecret - Update the database with the new password
3. testSecret - Verify the new password works
4. finishSecret - Mark the new version as current
"""

import boto3
import json
import logging
import os
import psycopg2
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
secrets_client = boto3.client('secretsmanager')


def lambda_handler(event: Dict[str, Any], context: Any) -> None:
    """
    Main handler for Secrets Manager rotation.

    Args:
        event: Rotation event from Secrets Manager
        context: Lambda context
    """
    logger.info(f"[ROTATION] Starting rotation for event: {json.dumps(event)}")

    arn = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    # Validate rotation is enabled
    metadata = secrets_client.describe_secret(SecretId=arn)

    if not metadata.get('RotationEnabled', False):
        logger.error(f"[ROTATION] Secret {arn} is not enabled for rotation")
        raise ValueError(f"Secret {arn} is not enabled for rotation")

    versions = metadata.get('VersionIdsToStages', {})

    if token not in versions:
        logger.error(f"[ROTATION] Secret version {token} has no stage for rotation")
        raise ValueError(f"Secret version {token} has no stage for rotation")

    # Skip if already current
    if "AWSCURRENT" in versions.get(token, []):
        logger.info(f"[ROTATION] Secret version {token} already set as AWSCURRENT - skipping")
        return

    # Execute rotation step
    logger.info(f"[ROTATION] Executing step: {step} for secret {arn}")

    if step == "createSecret":
        create_secret(secrets_client, arn, token)
    elif step == "setSecret":
        set_secret(secrets_client, arn, token)
    elif step == "testSecret":
        test_secret(secrets_client, arn, token)
    elif step == "finishSecret":
        finish_secret(secrets_client, arn, token)
    else:
        logger.error(f"[ROTATION] Invalid step: {step}")
        raise ValueError(f"Invalid step: {step}")

    logger.info(f"[ROTATION] Successfully completed step: {step}")


def create_secret(client: Any, arn: str, token: str) -> None:
    """
    Create a new secret version with a generated password.

    Args:
        client: Secrets Manager client
        arn: Secret ARN
        token: Version token
    """
    logger.info(f"[CREATE_SECRET] Creating new secret version for {arn}")

    # Get current secret
    try:
        current_secret = client.get_secret_value(
            SecretId=arn,
            VersionStage="AWSCURRENT"
        )
    except client.exceptions.ResourceNotFoundException:
        logger.error(f"[CREATE_SECRET] Current version not found for {arn}")
        raise

    secret_dict = json.loads(current_secret['SecretString'])

    # Generate new secure password
    new_password_response = client.get_random_password(
        PasswordLength=32,
        ExcludeCharacters='/@"\'\\'  # Exclude problematic characters
    )
    new_password = new_password_response['RandomPassword']

    # Update password in secret dict
    secret_dict['password'] = new_password

    # Update connection string if present
    if 'connection_string' in secret_dict:
        secret_dict['connection_string'] = (
            f"postgresql://{secret_dict['username']}:{new_password}@"
            f"{secret_dict['host']}:{secret_dict.get('port', 5432)}/{secret_dict['dbname']}"
        )

    # Store new secret version with AWSPENDING stage
    try:
        client.put_secret_value(
            SecretId=arn,
            ClientRequestToken=token,
            SecretString=json.dumps(secret_dict),
            VersionStages=['AWSPENDING']
        )
        logger.info(f"[CREATE_SECRET] Created new secret version {token} with AWSPENDING stage")
    except client.exceptions.ResourceExistsException:
        logger.info(f"[CREATE_SECRET] Version {token} already exists - skipping creation")


def set_secret(client: Any, arn: str, token: str) -> None:
    """
    Set the new password in the PostgreSQL database.

    Args:
        client: Secrets Manager client
        arn: Secret ARN
        token: Version token
    """
    logger.info(f"[SET_SECRET] Setting new password in database for {arn}")

    # Get pending secret
    pending = client.get_secret_value(
        SecretId=arn,
        VersionId=token,
        VersionStage="AWSPENDING"
    )
    pending_dict = json.loads(pending['SecretString'])

    # Get current secret
    current = client.get_secret_value(
        SecretId=arn,
        VersionStage="AWSCURRENT"
    )
    current_dict = json.loads(current['SecretString'])

    # Connect with current password
    logger.info(f"[SET_SECRET] Connecting to database {current_dict['host']}:{current_dict.get('port', 5432)}")

    try:
        conn = psycopg2.connect(
            host=current_dict['host'],
            port=current_dict.get('port', 5432),
            database=current_dict.get('dbname', 'postgres'),
            user=current_dict['username'],
            password=current_dict['password'],
            connect_timeout=10
        )

        # Set autocommit for ALTER USER
        conn.autocommit = True

        try:
            with conn.cursor() as cur:
                # Use parameterized query to avoid SQL injection
                username = current_dict['username']
                logger.info(f"[SET_SECRET] Changing password for user: {username}")

                # ALTER USER with new password
                cur.execute(
                    f"ALTER USER {username} WITH PASSWORD %s",
                    (pending_dict['password'],)
                )

            logger.info(f"[SET_SECRET] Successfully set new password in database")
        finally:
            conn.close()

    except psycopg2.Error as e:
        logger.error(f"[SET_SECRET] Database error: {str(e)}")
        raise


def test_secret(client: Any, arn: str, token: str) -> None:
    """
    Test that the new password works by connecting to the database.

    Args:
        client: Secrets Manager client
        arn: Secret ARN
        token: Version token
    """
    logger.info(f"[TEST_SECRET] Testing new password for {arn}")

    # Get pending secret
    pending = client.get_secret_value(
        SecretId=arn,
        VersionId=token,
        VersionStage="AWSPENDING"
    )
    pending_dict = json.loads(pending['SecretString'])

    # Test connection with new password
    logger.info(f"[TEST_SECRET] Testing connection to {pending_dict['host']}:{pending_dict.get('port', 5432)}")

    try:
        conn = psycopg2.connect(
            host=pending_dict['host'],
            port=pending_dict.get('port', 5432),
            database=pending_dict.get('dbname', 'postgres'),
            user=pending_dict['username'],
            password=pending_dict['password'],
            connect_timeout=10
        )

        # Verify connection works
        with conn.cursor() as cur:
            cur.execute('SELECT 1')
            result = cur.fetchone()
            if result[0] != 1:
                raise Exception("Test query returned unexpected result")

        conn.close()
        logger.info(f"[TEST_SECRET] Successfully tested new secret - connection verified")

    except psycopg2.Error as e:
        logger.error(f"[TEST_SECRET] Failed to connect with new password: {str(e)}")
        raise


def finish_secret(client: Any, arn: str, token: str) -> None:
    """
    Finish the rotation by marking the new version as AWSCURRENT.

    Args:
        client: Secrets Manager client
        arn: Secret ARN
        token: Version token
    """
    logger.info(f"[FINISH_SECRET] Finalizing rotation for {arn}")

    # Get secret metadata
    metadata = client.describe_secret(SecretId=arn)

    # Find current version and move AWSCURRENT stage to new version
    for version, stages in metadata.get('VersionIdsToStages', {}).items():
        if "AWSCURRENT" in stages and version != token:
            # Move AWSCURRENT from old version to new version
            logger.info(f"[FINISH_SECRET] Moving AWSCURRENT stage from {version} to {token}")

            client.update_secret_version_stage(
                SecretId=arn,
                VersionStage="AWSCURRENT",
                MoveToVersionId=token,
                RemoveFromVersionId=version
            )

            logger.info(f"[FINISH_SECRET] Rotation complete - {token} is now AWSCURRENT")
            break
    else:
        logger.warning(f"[FINISH_SECRET] No existing AWSCURRENT version found - setting {token} as AWSCURRENT")
        client.update_secret_version_stage(
            SecretId=arn,
            VersionStage="AWSCURRENT",
            MoveToVersionId=token
        )
