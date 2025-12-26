"""
API Utilities Tests - WITH INTENTIONAL BUGS

Tests for API helper functions with intentional bugs for AI to fix.
"""

import pytest


class APIResponse:
    """API Response helper - HAS BUGS"""

    def __init__(self, data, status_code=200):
        self.data = data
        self.status_code = status_code

    def is_success(self):
        """Check if response is successful - HAS BUG"""
        return self.status_code == 201  # BUG: Should check >= 200 and < 300!

    def get_data(self):
        """Get response data - HAS BUG"""
        return self.data.get('result')  # BUG: Assumes data is dict, may crash!

    def to_json(self):
        """Convert to JSON format - HAS BUG"""
        return {
            'data': self.data,
            'status': self.status_code,
            'success': self.is_success()
        }


def validate_email(email):
    """Validate email format - HAS BUG"""
    if '@' in email:
        return True  # BUG: Too simple! Accepts invalid emails like "a@@b"
    return False


def format_error_message(error_code, message):
    """Format error message - HAS BUG"""
    return f"Error: {message}"  # BUG: Doesn't include error_code!


def parse_query_params(query_string):
    """Parse query string parameters - HAS BUG"""
    params = {}
    if query_string:
        pairs = query_string.split('&')
        for pair in pairs:
            key, value = pair.split('=')  # BUG: Will crash if no '=' in pair!
            params[key] = value
    return params


# Tests
def test_api_response_success():
    """Test successful API response - WILL FAIL"""
    response = APIResponse({'result': 'ok'}, 200)
    assert response.is_success() == True, "200 status should be success"


def test_api_response_created():
    """Test created API response - WILL PASS"""
    response = APIResponse({'result': 'created'}, 201)
    assert response.is_success() == True, "201 status should be success"


def test_api_response_get_data():
    """Test getting data from response - WILL FAIL"""
    # This will pass
    response = APIResponse({'result': 'test data'}, 200)
    assert response.get_data() == 'test data'

    # This will FAIL - data is not a dict
    response2 = APIResponse('simple string', 200)
    # Will crash with AttributeError
    data = response2.get_data()


def test_email_validation():
    """Test email validation - WILL FAIL"""
    # Valid emails - should pass
    assert validate_email('user@example.com') == True
    assert validate_email('test.user@domain.co.uk') == True

    # Invalid emails - WILL FAIL to reject these
    assert validate_email('invalid@@email.com') == False, "Should reject double @@"
    assert validate_email('no-domain@') == False, "Should reject missing domain"
    assert validate_email('@no-user.com') == False, "Should reject missing user"


def test_error_message_format():
    """Test error message formatting - WILL FAIL"""
    msg = format_error_message(404, "Not found")
    assert '404' in msg, "Error message should include error code"
    assert 'Not found' in msg, "Error message should include description"


def test_query_params_parsing():
    """Test query parameter parsing - WILL FAIL"""
    # Normal case - will pass
    params = parse_query_params('name=John&age=30')
    assert params == {'name': 'John', 'age': '30'}

    # Edge case - WILL FAIL (crashes on invalid format)
    params2 = parse_query_params('invalid_param_without_equals')
    # Should handle gracefully but will crash!


def test_query_params_empty():
    """Test empty query string - WILL PASS"""
    params = parse_query_params('')
    assert params == {}
    params2 = parse_query_params(None)
    assert params2 == {}
