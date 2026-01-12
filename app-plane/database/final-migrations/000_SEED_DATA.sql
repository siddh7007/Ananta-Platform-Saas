--
-- PostgreSQL database dump
--

-- Dumped from database version 15.1 (Ubuntu 15.1-1.pgdg20.04+1)
-- Dumped by pg_dump version 15.5 (Ubuntu 15.5-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.organizations VALUES ('a0000000-0000-0000-0000-000000000001', 'Platform Admin', 'platform-admin', 'Internal platform administrators and CNS staff', 'active', 'enterprise', NULL, 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organizations VALUES ('a0000000-0000-0000-0000-000000000002', 'CNS Staff', 'cns-staff', 'Component Normalization Service staff organization', 'active', 'enterprise', NULL, 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organizations VALUES ('a0000000-0000-0000-0000-000000000000', 'Demo Organization', 'demo-org', 'Demo customer organization for testing', 'trial', 'standard', NULL, 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organizations VALUES ('b0000000-0000-4000-a000-000000000001', 'Ananta Platform', 'ananta-platform', NULL, 'trial', 'standard', 'billing@ananta.dev', 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-11 02:14:57.016795+00', '2026-01-11 02:14:57.016795+00');
INSERT INTO public.organizations VALUES ('b0000000-0000-4000-a000-000000000002', 'CNS Staff', 'cns-staff-cp', NULL, 'trial', 'standard', 'billing@cns-staff.ananta.dev', 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-11 02:19:32.122523+00', '2026-01-11 02:19:32.122523+00');
INSERT INTO public.organizations VALUES ('b0000000-0000-4000-a000-000000000000', 'Demo Organization', 'demo-org-cp', NULL, 'trial', 'standard', 'billing@demo.example.com', 'UTC', 'us-east-1', 10, 50000, 100, 0, 0, 0.00, NULL, NULL, NULL, '2026-01-11 02:19:32.125375+00', '2026-01-11 02:19:32.125375+00');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000001', 'superadmin@ananta.dev', false, 'Super', 'Admin', NULL, NULL, NULL, 'superadmin@ananta.dev', 'super_admin', true, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000010', 'admin@ananta.dev', false, 'Platform', 'Admin', NULL, NULL, NULL, 'admin@ananta.dev', 'admin', true, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000012', 'backstage-admin@ananta.dev', false, 'Backstage', 'Admin', NULL, NULL, NULL, 'backstage-admin@ananta.dev', 'admin', true, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000002', 'cns-lead@ananta.dev', false, 'CNS', 'Lead', NULL, NULL, NULL, 'cns-lead@ananta.dev', 'owner', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000003', 'cns-engineer@ananta.dev', false, 'CNS', 'Engineer', NULL, NULL, NULL, 'cns-engineer@ananta.dev', 'engineer', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000011', 'cnsstaff@ananta.dev', false, 'CNS', 'Staff', NULL, NULL, NULL, 'cnsstaff@ananta.dev', 'engineer', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000004', 'demo-owner@example.com', false, 'Demo', 'Owner', NULL, NULL, NULL, 'demo-owner@example.com', 'owner', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000005', 'demo-engineer@example.com', false, 'Demo', 'Engineer', NULL, NULL, NULL, 'demo-engineer@example.com', 'engineer', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('c0000000-0000-0000-0000-000000000013', 'demo-analyst@example.com', false, 'Demo', 'Analyst', NULL, NULL, NULL, 'demo-analyst@example.com', 'analyst', false, true, NULL, '{}', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', NULL);
INSERT INTO public.users VALUES ('112ceb82-b7d3-4778-b4cd-218a15ff69bb', 'cbpadmin@ananta.dev', false, 'cbpadmin', '', NULL, NULL, 'c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000010', 'super_admin', true, true, NULL, '{}', '2026-01-11 03:50:37.176274+00', '2026-01-11 04:08:17.719903+00', NULL);


--
-- Data for Name: organization_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.organization_memberships VALUES ('7a7b6c74-e7f1-44af-b381-21e54935578d', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin', false, NULL, '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00');
INSERT INTO public.organization_memberships VALUES ('266eb548-8af3-4172-8fde-ec7a47c36453', 'c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'admin', false, NULL, '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00');
INSERT INTO public.organization_memberships VALUES ('8bf009a2-e572-4d1e-845c-8fdaac324ed9', 'c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'admin', false, NULL, '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00', '2026-01-11 03:26:09.31545+00');
INSERT INTO public.organization_memberships VALUES ('3a8355f2-b1a5-45e9-a7d6-e44b3fb0d975', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'owner', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('44bcb6ef-af27-4e9a-b7d6-5140d6d7ffb1', 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'engineer', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('707038dc-1c37-4bb5-865a-aa1cf03c1f93', 'c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', 'engineer', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('4e957910-fca3-4b37-b8f7-f58ae5218cb6', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 'owner', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('ce4baf77-794b-4bbf-a04e-3065bd755cec', 'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000000', 'engineer', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('149440af-97e0-4c5e-bad1-26d6d0276995', 'c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000000', 'analyst', true, NULL, '2026-01-10 19:54:54.38746+00', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00');
INSERT INTO public.organization_memberships VALUES ('3016f740-2ca6-41af-9315-3e40fef0eead', 'c0000000-0000-0000-0000-000000000010', 'b0000000-0000-4000-a000-000000000001', 'admin', false, NULL, '2026-01-11 02:17:34.301413+00', '2026-01-11 02:17:34.301413+00', '2026-01-11 02:17:34.301413+00');
INSERT INTO public.organization_memberships VALUES ('02c4057b-df9f-4ce7-8b70-f92140f8e87d', '112ceb82-b7d3-4778-b4cd-218a15ff69bb', 'a0000000-0000-0000-0000-000000000001', 'admin', false, NULL, '2026-01-11 04:08:17.719903+00', '2026-01-11 04:08:17.719903+00', '2026-01-11 04:08:17.719903+00');
INSERT INTO public.organization_memberships VALUES ('9a945293-844f-4f7d-8f17-68ca85fa8e64', '112ceb82-b7d3-4778-b4cd-218a15ff69bb', 'b0000000-0000-4000-a000-000000000001', 'owner', false, NULL, '2026-01-11 04:08:24.850511+00', '2026-01-11 04:08:24.850511+00', '2026-01-11 04:08:24.850511+00');


--
-- Data for Name: workspaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.workspaces VALUES ('d1000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000001', 'Default Workspace', 'default', 'Default workspace for Ananta Platform', 'private', '{}', NULL, '2026-01-11 02:14:57.019135+00', '2026-01-11 02:14:57.019135+00', true);
INSERT INTO public.workspaces VALUES ('d1000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000002', 'Default Workspace', 'default', 'Default workspace for CNS Staff', 'private', '{}', NULL, '2026-01-11 02:19:32.126896+00', '2026-01-11 02:19:32.126896+00', true);
INSERT INTO public.workspaces VALUES ('d1000000-0000-4000-a000-000000000000', 'b0000000-0000-4000-a000-000000000000', 'Default Workspace', 'default', 'Default workspace for Demo Organization', 'private', '{}', NULL, '2026-01-11 02:19:32.129134+00', '2026-01-11 02:19:32.129134+00', true);
INSERT INTO public.workspaces VALUES ('d1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Default Workspace', 'default', 'Default workspace for Ananta Platform organization', 'team', '{}', 'c0000000-0000-0000-0000-000000000001', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00', false);
INSERT INTO public.workspaces VALUES ('d1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Default Workspace', 'default', 'Default workspace for CNS Staff organization', 'team', '{}', 'c0000000-0000-0000-0000-000000000002', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00', false);
INSERT INTO public.workspaces VALUES ('d1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 'Default Workspace', 'default', 'Default workspace for Demo organization', 'team', '{}', 'c0000000-0000-0000-0000-000000000004', '2026-01-10 19:54:54.38746+00', '2026-01-11 02:14:00.060452+00', false);


--
-- Data for Name: workspace_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.workspace_members VALUES ('73508340-6d40-4ea4-82a6-c51cb8ccdb21', 'd1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000012', 'admin', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('97cb69a6-0995-4caf-be5d-b8072757d4b4', 'd1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000013', 'viewer', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('f8bccd61-4a05-4773-921f-8d17d7cbe78d', 'd1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'member', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('f0802feb-b687-4e7e-a5a6-5b8bc61f500e', 'd1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'owner', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('00b9de71-13d2-40d0-b474-6266d2b43422', 'd1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'owner', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('b2c9d24b-92fd-4115-a75d-0a0942bafe70', 'd1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'member', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('5724faaf-5b61-4182-bb75-49a5c9870f40', 'd1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'member', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('9138178d-2ff3-466b-9c6e-b6e970556c23', 'd1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'owner', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('d1bb7e46-ecea-41ae-9110-f5d8c117a44a', 'd1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner', '2026-01-10 19:54:54.38746+00');
INSERT INTO public.workspace_members VALUES ('1b2e87f4-9a22-47e5-8c63-0549042333cd', 'd1000000-0000-4000-a000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'admin', '2026-01-11 02:17:34.305528+00');
INSERT INTO public.workspace_members VALUES ('00089346-693c-4af9-baaa-b04caab2ec14', 'd1000000-0000-4000-a000-000000000001', '112ceb82-b7d3-4778-b4cd-218a15ff69bb', 'owner', '2026-01-11 03:52:23.260969+00');


--
-- PostgreSQL database dump complete
--

