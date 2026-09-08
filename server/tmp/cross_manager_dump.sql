--
-- PostgreSQL database dump
--

\restrict deL9fRiInDqNP20fXp9AViRAhGl1dcVgUMtlllaKRd64ednuYtYca71O3N7Z4Zs

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_modified_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_modified_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: contract_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid,
    group_name character varying(50),
    name character varying(100),
    spec character varying(100),
    quantity numeric(12,2) DEFAULT 0,
    unit character varying(20),
    unit_price numeric(15,2) DEFAULT 0,
    amount numeric(15,2) DEFAULT 0,
    note text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    code character varying(50),
    type character varying(20),
    category character varying(20),
    name character varying(255),
    total_amount numeric(15,2) DEFAULT 0,
    cost_direct numeric(15,2) DEFAULT 0,
    cost_indirect numeric(15,2) DEFAULT 0,
    risk_fee numeric(15,2) DEFAULT 0,
    margin numeric(15,2) DEFAULT 0,
    regulation_config jsonb,
    client_manager character varying(100),
    our_manager character varying(100),
    contract_date date,
    start_date date,
    end_date date,
    terms_payment text,
    terms_penalty text,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: dms_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dms_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    parent_category character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    sequence_no integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: document_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    version character varying(20) NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    change_log text,
    file_content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    category character varying(100) NOT NULL,
    sub_category character varying(100),
    type character varying(100),
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'DRAFT'::character varying,
    security_level character varying(20) DEFAULT 'NORMAL'::character varying,
    current_version character varying(20) DEFAULT 'v1'::character varying,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    locked_by text,
    locked_at timestamp without time zone,
    locked_by_name text
);


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id character varying(255) NOT NULL,
    equipment_id character varying(100),
    name character varying(255) NOT NULL,
    category character varying(100),
    model character varying(255),
    manufacturer character varying(255),
    manufacture_year integer,
    specifications character varying(255),
    serial_number character varying(255),
    acquisition_date date,
    equipment_status character varying(50) DEFAULT '가품'::character varying,
    purchase_type character varying(50),
    purchase_amount numeric(15,2),
    residual_value numeric(15,2),
    depreciation_method character varying(50),
    contract_start_date date,
    contract_end_date date,
    supplier character varying(255),
    supplier_contact character varying(255),
    warranty_period character varying(100),
    registration_number character varying(255),
    insurance_info text,
    inspection_cycle character varying(100),
    last_inspection_date date,
    next_inspection_date date,
    assigned_site character varying(255),
    operator_name character varying(255),
    primary_use character varying(255),
    operating_hours character varying(100),
    usage_restrictions text,
    maintenance_cycle character varying(100),
    consumables_cycle character varying(255),
    parts_lifespan text,
    service_provider character varying(255),
    service_contact character varying(255),
    accumulated_hours numeric(10,2),
    fuel_consumption numeric(10,2),
    work_performance text,
    failure_records text,
    downtime_hours numeric(10,2),
    fuel_cost numeric(15,2),
    maintenance_cost numeric(15,2),
    insurance_cost numeric(15,2),
    depreciation_cost numeric(15,2),
    rental_cost numeric(15,2),
    total_cost numeric(15,2),
    documents jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50),
    name character varying(255),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: report_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid,
    approver_id character varying(100),
    step integer DEFAULT 1,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    comment text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    layout_config jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    template_id uuid,
    title character varying(200),
    report_date date DEFAULT CURRENT_DATE,
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    content jsonb,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resources (
    id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    project_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_checklist_templates (
    id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    items jsonb,
    category character varying(100),
    updated_at date DEFAULT CURRENT_DATE
);


--
-- Name: sms_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    template_id character varying(50),
    title character varying(255),
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    results jsonb,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_document_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_document_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid,
    commenter_name character varying(100),
    commenter_role character varying(50),
    comment text NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    category character varying(50),
    title character varying(255) NOT NULL,
    description text,
    file_url text,
    file_name character varying(255),
    file_size integer,
    uploaded_by character varying(100),
    upload_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_dris; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_dris (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    date date DEFAULT CURRENT_DATE,
    location character varying(255),
    work_content text,
    risk_points text,
    attendees_count integer DEFAULT 0,
    photo_url text,
    status character varying(50) DEFAULT 'COMPLETED'::character varying,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_education_attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_education_attendees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    education_id uuid,
    worker_name character varying(100),
    worker_birth character varying(50),
    worker_agency character varying(100),
    signature_url text,
    attended_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_educations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_educations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    title character varying(255) NOT NULL,
    type character varying(50),
    instructor character varying(100),
    date date DEFAULT CURRENT_DATE,
    place character varying(100),
    content text,
    photo_url text,
    status character varying(50) DEFAULT 'PLANNED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_incident_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_incident_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id uuid,
    photo_url text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    type character varying(50),
    title character varying(255) NOT NULL,
    date date DEFAULT CURRENT_DATE,
    "time" character varying(50),
    place character varying(100),
    description text,
    cause text,
    measure text,
    reporter character varying(100),
    status character varying(50) DEFAULT 'REPORTED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_patrols; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_patrols (
    id integer NOT NULL,
    project_id uuid,
    location character varying(255),
    issue_type character varying(50),
    severity character varying(20),
    description text,
    action_required character varying(255),
    photo_url text,
    status character varying(20) DEFAULT 'OPEN'::character varying,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_patrols_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sms_patrols_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sms_patrols_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sms_patrols_id_seq OWNED BY public.sms_patrols.id;


--
-- Name: sms_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    name character varying(100) NOT NULL,
    birth_date character varying(20),
    job_type character varying(50),
    blood_type character varying(10),
    phone character varying(20),
    agency character varying(100),
    qr_code_data text,
    photo_url text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_risk_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_risk_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    process_name character varying(255) NOT NULL,
    assessor_name character varying(100),
    approver_name character varying(100),
    status character varying(50) DEFAULT 'DRAFT'::character varying,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_risk_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_risk_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid,
    risk_factor text NOT NULL,
    risk_type character varying(100),
    frequency integer DEFAULT 1,
    severity integer DEFAULT 1,
    mitigation_measure text,
    action_manager character varying(100),
    action_deadline date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_generations (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    project_id character varying(100),
    generation_date date DEFAULT CURRENT_DATE,
    material_type_id character varying(100),
    process_name character varying(100),
    quantity numeric(12,2) DEFAULT 0,
    unit character varying(20),
    location character varying(100),
    notes text,
    status character varying(20) DEFAULT 'REGISTERED'::character varying,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_inbounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_inbounds (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    project_id character varying(100),
    inbound_date date DEFAULT CURRENT_DATE,
    warehouse_id character varying(100),
    vendor_id character varying(100),
    material_type_id character varying(100),
    grade text DEFAULT 'A'::text,
    quantity numeric(12,2) DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'CONFIRMED'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_inventory (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    warehouse_id character varying(100),
    material_type_id character varying(100),
    grade text DEFAULT 'A'::text,
    quantity numeric(12,2) DEFAULT 0,
    last_updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_inventory_adjustments (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    warehouse_id character varying(100),
    material_type_id character varying(100),
    quantity numeric(12,2) NOT NULL,
    reason text,
    adjustment_type character varying(50),
    adjustment_date date DEFAULT CURRENT_DATE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_material_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_material_types (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    code character varying(50),
    name character varying(100) NOT NULL,
    category character varying(50),
    unit character varying(20) DEFAULT '톤'::character varying,
    unit_price numeric(10,2) DEFAULT 0,
    symbol character varying(10)
);


--
-- Name: swms_outbounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_outbounds (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    project_id character varying(100),
    outbound_date date DEFAULT CURRENT_DATE,
    warehouse_id character varying(100),
    vendor_id character varying(100),
    material_type_id character varying(100),
    grade text DEFAULT 'A'::text,
    quantity numeric(12,2) DEFAULT 0,
    unit_price numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_settlement_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_settlement_items (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    settlement_id character varying(100),
    outbound_id character varying(100)
);


--
-- Name: swms_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_settlements (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    vendor_id character varying(100),
    start_date date,
    end_date date,
    total_supply_price numeric(15,2),
    total_vat numeric(15,2),
    total_amount numeric(15,2),
    status character varying(20) DEFAULT 'DRAFT'::character varying,
    tax_invoice_no character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_vendors (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50),
    contact character varying(100),
    registration_no character varying(50)
);


--
-- Name: swms_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_warehouses (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    name character varying(100) NOT NULL,
    type character varying(50) DEFAULT 'General'::character varying,
    capacity numeric(15,2),
    unit character varying(20) DEFAULT '톤'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: swms_weighings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swms_weighings (
    id character varying(100) DEFAULT (gen_random_uuid())::text NOT NULL,
    site_id character varying(100),
    project_id character varying(100),
    weighing_date date DEFAULT CURRENT_DATE,
    weighing_time time without time zone DEFAULT CURRENT_TIME,
    vehicle_number character varying(20),
    driver_name character varying(50),
    driver_contact character varying(50),
    material_type_id character varying(100),
    direction character varying(10) DEFAULT 'IN'::character varying,
    gross_weight numeric(12,2) DEFAULT 0,
    tare_weight numeric(12,2) DEFAULT 0,
    net_weight numeric(12,2) DEFAULT 0,
    vendor_id character varying(100),
    notes text,
    created_by character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    uid character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    role character varying(50) DEFAULT 'field'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    contact character varying(50),
    code character varying(50),
    branch character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sms_patrols id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_patrols ALTER COLUMN id SET DEFAULT nextval('public.sms_patrols_id_seq'::regclass);


--
-- Data for Name: contract_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contract_items (id, contract_id, group_name, name, spec, quantity, unit, unit_price, amount, note, created_at) FROM stdin;
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, project_id, code, type, category, name, total_amount, cost_direct, cost_indirect, risk_fee, margin, regulation_config, client_manager, our_manager, contract_date, start_date, end_date, terms_payment, terms_penalty, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dms_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dms_categories (id, project_id, parent_category, name, sequence_no, created_at) FROM stdin;
\.


--
-- Data for Name: document_versions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.document_versions (id, document_id, version, file_path, file_size, change_log, file_content, created_at) FROM stdin;
f0b11b44-29d0-44be-9bf9-5b4c1bff9e3d	3a7fecfa-a5f0-4c91-9877-ee7fef4c486f	v1	documents/mock/3a7fecfa-a5f0-4c91-9877-ee7fef4c486f.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
4839a533-6e85-493c-a4fc-9b4f0516608f	1b4d824a-a29f-404c-846e-49ebdb2a246b	v1	documents/mock/1b4d824a-a29f-404c-846e-49ebdb2a246b.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
f352297d-28bd-4051-9a99-fe3b0e9c8344	b7b448fd-612f-4ca8-b71d-d8262860b366	v1	documents/mock/b7b448fd-612f-4ca8-b71d-d8262860b366.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
e2fe849d-c43b-479e-b772-a031d6a7b349	ae36c1da-33d7-4fba-851c-056db0f01597	v1	documents/mock/ae36c1da-33d7-4fba-851c-056db0f01597.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
5f000f6d-b5bd-461b-8b1f-0936b4750db3	87f70c86-a5d8-4502-a6fc-6722b6242531	v1	documents/mock/87f70c86-a5d8-4502-a6fc-6722b6242531.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
c2f8fbfe-e2c5-490c-9219-c2b51c59c3cf	a69dd88c-d7f4-4d0d-be80-bc6ff4ef00f2	v1	documents/mock/a69dd88c-d7f4-4d0d-be80-bc6ff4ef00f2.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
10826f54-560f-49fc-bbee-467e34730449	d64c86fe-216c-4488-9d8a-069940501283	v1	documents/mock/d64c86fe-216c-4488-9d8a-069940501283.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
e34e9ea3-d934-4021-8ffe-2ff91f882d39	ae442453-80c0-42db-81ef-23b49f736dcc	v1	documents/mock/ae442453-80c0-42db-81ef-23b49f736dcc.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
78138f04-517b-4ca3-b47f-5805f836271b	c794a507-9258-4714-bb72-f6d6f555ea3e	v1	documents/mock/c794a507-9258-4714-bb72-f6d6f555ea3e.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
8fd106ec-8463-4581-ae49-d2124aaee333	4583bbeb-ff63-4894-a268-f64adb803d4b	v1	documents/mock/4583bbeb-ff63-4894-a268-f64adb803d4b.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
0b437dda-3d57-492e-ba7a-038b31ec9e51	c9bea31c-9487-47cf-925e-1c30fd5f0db0	v1	documents/mock/c9bea31c-9487-47cf-925e-1c30fd5f0db0.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
2ead05d4-f58b-4f3d-9055-02eb813ea409	8b3176e5-ea99-4d4d-9d33-af3e4f8bdd63	v1	documents/mock/8b3176e5-ea99-4d4d-9d33-af3e4f8bdd63.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
0a3a02f3-d674-48fd-a07e-b8ac2ce0e396	3f97ca57-c51e-49f7-a772-28fee57c869f	v1	documents/mock/3f97ca57-c51e-49f7-a772-28fee57c869f.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
5f250fd7-79c1-42f4-8f04-dc37022e5284	894cee31-2506-4907-9bdb-16d1ba5eb8d4	v1	documents/mock/894cee31-2506-4907-9bdb-16d1ba5eb8d4.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
3174ea8e-a3b2-4c64-87f6-e438ff4ae666	0f5b90ee-ccc1-4602-85cd-da0b7d702f67	v1	documents/mock/0f5b90ee-ccc1-4602-85cd-da0b7d702f67.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
5a0484f0-0a82-43b1-b1c7-b27f629d6fb5	5b0be492-5f3f-446d-891a-64c487849338	v1	documents/mock/5b0be492-5f3f-446d-891a-64c487849338.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
97adebc2-0938-4e6e-9c7f-baa031a37ead	888bfa6c-6699-426a-851f-c4c621f3df9d	v1	documents/mock/888bfa6c-6699-426a-851f-c4c621f3df9d.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
97a2d0da-ea55-4054-b5ad-beb02dff4984	e31f823c-274a-4e62-80a9-657cf2c06e87	v1	documents/mock/e31f823c-274a-4e62-80a9-657cf2c06e87.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
25e0a679-7a0a-4843-9588-0c80c1d6feec	851ac435-95f9-4108-ac7e-9943aa983cfb	v1	documents/mock/851ac435-95f9-4108-ac7e-9943aa983cfb.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
a23b574d-4110-487d-a059-b0c5c8abca68	d6c2ef93-7574-469f-aa5f-b1ae44f06098	v1	documents/mock/d6c2ef93-7574-469f-aa5f-b1ae44f06098.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
b2de1c65-ff15-4387-a3fc-c186a419a1ad	b268ae6c-f242-4b24-a4ae-902decc3862f	v1	documents/mock/b268ae6c-f242-4b24-a4ae-902decc3862f.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
78ae9079-73db-4d04-816d-89da90f2771e	6aa4b404-a828-4dd2-a88e-5372a001dc8f	v1	documents/mock/6aa4b404-a828-4dd2-a88e-5372a001dc8f.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
80d8a1cb-4814-4ab5-8d1d-6c4624b543ea	4775fd23-72f6-4602-9bba-72f7d6b978f5	v1	documents/mock/4775fd23-72f6-4602-9bba-72f7d6b978f5.pdf	1234567	Initial Seed	MOCK_BASE64_CONTENT	2026-03-28 11:16:23.316713
01d8edfa-51e6-442e-abcf-541616551bab	d9870386-58ce-41ab-9fa0-7bdbcd32d20e	v1	documents/mock/1b4d824a-a29f-404c-846e-49ebdb2a246b.pdf	1234567	Copy of document 1b4d824a-a29f-404c-846e-49ebdb2a246b	MOCK_BASE64_CONTENT	2026-03-28 12:29:20.257927
76a8815d-d3ee-4e82-b5e3-beab2f4769fc	f235d7fe-5159-4650-bb6f-beccf7ef4616	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240722_사업자_온세이프티_사업자등록증_관리감독자.pdf	706798	Initial automated ingestion	\N	2026-03-28 15:26:44.100712
9897fe26-d9f6-43cb-962e-c4ad3e26cb63	3555c763-5591-4515-abe6-5c577624b1f9	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230714_사업자_(주)원방_사업자등록증_(2023-07-14)_크레인 집게차(96거5789).jpg	212406	Initial automated ingestion	\N	2026-03-28 15:26:44.019174
6b6cdfe1-c0c3-40fc-9cca-03bfc8368482	82aeea9e-ac5c-46b3-b440-e8a845d11d3f	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231211_사업자_크로스특수_사업자등록증_2. 도급 신고 서류.pdf	201360	Initial automated ingestion	\N	2026-03-28 15:26:44.04833
b54a5e35-d935-4ae4-8f3d-27e5b26fd88a	061ac33a-3c02-47b5-89a7-6c6f88e631df	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231211_사업자_크로스특수_사업자등록증_10. 화관법 도급신고.pdf	201360	Initial automated ingestion	\N	2026-03-28 15:26:44.035839
ae2e5c17-17a6-410f-9ac1-667a1f6d342e	c1f63a66-2447-4e4e-8211-4a3b28f9eb41	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240722_계약_위탁계약서_및_개인정보활용동의서_관리감독자.hwp	145408	Initial automated ingestion	\N	2026-03-28 15:26:44.147043
fcf9e3a9-19cc-446e-95e7-3778079988fe	6789aace-2e9f-4aa0-90a6-c7eee74fafdd	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250701_계약_07.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	116778	Initial automated ingestion	\N	2026-03-28 15:26:44.158347
dda20214-9b0d-43b0-8b73-73a6cf66b3dc	8b1b5ff0-4ab6-43c6-9463-de9e8cefacd9	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250601_계약_06.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	116754	Initial automated ingestion	\N	2026-03-28 15:26:44.153359
ed3febfa-40e7-4f82-b1a0-19b693d449dd	f87888ed-07f4-45f9-97e4-e213b898a178	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250801_계약_08.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	116744	Initial automated ingestion	\N	2026-03-28 15:26:44.164167
5dc7671d-158f-485e-b559-c097c9833201	8add98b1-3f59-4bf9-8dd4-99e87981abfe	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240411_선임_안전관리자_선임보고서(건설업)_양식_1-5. 안전관리자 선임 서류.hwp	70656	Initial automated ingestion	\N	2026-03-28 15:26:44.199026
ab86529a-3415-4ea4-ab7a-c764a7001a41	4c5dfe0a-85bb-429a-98ee-85a1adb4dbe6	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231209_선임_[서식]_안전보건총괄_및_관리책임자_선임서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	26624	Initial automated ingestion	\N	2026-03-28 15:26:44.190585
985b7c78-ca02-4735-b5d4-e6c03835e9c4	87f54b2f-7eee-4074-9121-711597f15411	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240620_계약_업체명_위탁계약서_및_개인정보활용동의서(240620)_관리감독자.pdf	24576	Initial automated ingestion	\N	2026-03-28 15:26:44.134032
a51bd7ad-304b-4d62-acc3-815509001960	e4455bef-49bc-4a52-970b-b053f7e3b350	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240724_선임_1_1._안전보건총괄책임자_선임서_SAMPLE_7_1. 안전보건총괄책임자.xlsx	12032	Initial automated ingestion	\N	2026-03-28 15:26:44.203193
0fba87de-fa1e-492a-a659-655a0613827d	1cf9c203-b5fa-4ce9-83f9-a2308a861884	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240725_선임_2_1._안전보건관리책임자_선임서_SAMPLE_7_2. 안전보건관리책임자.xlsx	11711	Initial automated ingestion	\N	2026-03-28 15:26:44.20503
ad241182-3db4-47e6-ae09-ae06f9b2b002	248607bb-1e2e-4e66-9a9c-f1e1fdb639c4	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230315_점검_(3-3-0)_교량점검로_설치_작업_3.토목공사.pptx	4156214	Initial automated ingestion	\N	2026-03-28 15:26:45.707894
db61f750-0e41-4262-a87e-efb8127e32f9	e79e2d93-bda8-4e53-a667-ca67b816a20d	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220409_교육_(특별교육)29.콘크리트인공구조물의_해체_또는_파괴작업(트리니트로톨루엔(TNT))_29번_(특별교육)콘크리트인공구조물의 해체 또는 파괴작업.pdf	3717843	Initial automated ingestion	\N	2026-03-28 15:26:45.354137
ae48d4ad-5f49-4a40-a2ee-b8bbd0f7a88b	46aaa415-6b95-4424-a9a1-b43e573dac05	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230327_안전_[21년_건설]_안전보건관리체계_자율점검표(1월)_안전보건공단_02.건설업.pdf	2908057	Initial automated ingestion	\N	2026-03-28 15:26:46.063743
f9b23c13-0fce-4680-bc99-b7365d9dd205	ace21f98-254a-4552-8265-9dd79e127e33	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20251020_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.05_(인력)_251020_1. 결제 완료_(스캔본).pdf	2869820	Initial automated ingestion	\N	2026-03-28 15:26:44.4639
9190952b-7fb6-4f52-abc0-7ac85ce027f9	b685a9d7-fa22-4f37-aa1b-6e80482e935a	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250909_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.04_(인력)_250908_1. 결제 완료_(스캔본).pdf	2629317	Initial automated ingestion	\N	2026-03-28 15:26:44.236354
952277f9-cf26-4003-911a-f6d9af4bae94	f111370e-bd9c-470f-af67-23163f723611	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20251021_내역서_(크로스)안전보건관리비_사용내역서_2508월_⑨안전관리비_기흥SR5,CDI철거현장(월).xlsx	2483478	Initial automated ingestion	\N	2026-03-28 15:26:44.571578
a6ea19b8-1203-41f0-a56e-4f71be8a3fc1	c0a077c1-74c3-45f7-9fe2-73ffbf9f442e	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(토목작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf	1726010	Initial automated ingestion	\N	2026-03-28 15:26:45.517246
37bdf2d1-e98c-447c-b5b4-74664e8a34d7	1b303ffb-aade-4335-a4be-3df9d07e46ae	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20121207_안전_KRA_48.안전가시설_작업_위험성평가 가이드.xls	1705472	Initial automated ingestion	\N	2026-03-28 15:26:45.587443
c60ebf1a-1840-4d17-b536-0558e94b06ac	6741fb17-8118-413d-acab-9e1dfd1b8880	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf	1391593	Initial automated ingestion	\N	2026-03-28 15:26:45.469724
a597e432-226e-4f18-bbf4-499e1f5e0ea2	4d678fd9-d6f1-4876-8a28-fd5481eb2e59	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230315_TBM_(3-34-0)_TBM터널_굴착_작업_3.토목공사.pptx	1173795	Initial automated ingestion	\N	2026-03-28 15:26:46.191912
8c0c2049-cbe8-4d65-a904-efa467ac103b	f3fc94cd-1a40-4ae0-a4da-e9153d7c2261	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_제조_04.서식.pdf	977335	Initial automated ingestion	\N	2026-03-28 15:26:46.162717
578f7b24-4fbf-472c-93e2-9e0227dd3a6c	c2ea916e-1021-48cc-b3b9-cdec270db51b	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220715_안전_첨부9._안전보호구_지급대장_4. 8BC 도급신고 제반 서류.pdf	585395	Initial automated ingestion	\N	2026-03-28 15:26:46.243374
a8a18e45-0aac-491e-9318-5835b7535307	856673c6-552d-4ad2-a6af-4577092299a0	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_건설_04.서식.pdf	304581	Initial automated ingestion	\N	2026-03-28 15:26:46.137303
3d70f404-f46e-49a2-884f-a9ff9f760c04	e62ea67a-8004-4b9d-b4f9-d0c5979c4aa8	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx	285898	Initial automated ingestion	\N	2026-03-28 15:26:45.643731
6496d879-c7c0-4526-b8ec-70cd21d84ea9	1d7a1c78-ee70-4105-a1fc-a3e44f704413	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250708_인력_운반용_중량물_취급계획서_(인력)_250708_1. 결제 완료_(스캔본).pdf	209401	Initial automated ingestion	\N	2026-03-28 15:26:44.220332
10c76a1a-4a03-448a-8abe-4d98685776eb	24eaf759-36d3-4922-8589-94ef88b986c0	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220714_안전_첨부7._안전보호구_착용_및_관리_규정_4. 8BC 도급신고 제반 서류.pdf	157293	Initial automated ingestion	\N	2026-03-28 15:26:46.231351
ef9eeb37-f51c-4a53-8d41-88a7843e7d6e	cf90a009-4aaa-4b8f-a213-f60d2115ee51	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231129_내역서_[서식]_안전보건관리비_사용내역서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	70144	Initial automated ingestion	\N	2026-03-28 15:26:44.55829
97b34dec-dc95-46e2-a0a9-596e2868854a	b0e3b2d4-3ded-4835-b470-5caab37f9dcd	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230315_안전_[서식]_안전보건경영방침,안전계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	33280	Initial automated ingestion	\N	2026-03-28 15:26:45.682079
2b3d0434-3a57-4935-9701-c2064b0e31d1	e3fedf6b-339c-43a4-8993-080e931b5c87	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	24064	Initial automated ingestion	\N	2026-03-28 15:26:45.695617
9b1fe808-f849-4100-99b1-933fbd7e13a5	8e1244c2-d83e-4af6-a5af-d54e492dc1ee	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230315_인력_[서식]_안전예산편성,안전보건_전문인력_평가표_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	23040	Initial automated ingestion	\N	2026-03-28 15:26:44.211046
2b8e6d3c-d28f-4afa-86f9-7aed70aeea6b	e19f8838-1714-4075-99ef-42247399f826	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230823_보호구_[서식]_보호구_밀착도_검사시트_04.서식.hwp	16896	Initial automated ingestion	\N	2026-03-28 15:26:46.265017
608eacc7-70c9-4afc-956b-fa107031f21f	054f44e3-a20c-40be-b632-fa10d9209da4	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230315_안전_[서식]_연간_안전교육_계획_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	14848	Initial automated ingestion	\N	2026-03-28 15:26:45.689356
bcb28a19-2cc7-467a-86df-011a3d3b9b80	fc2acb65-bdd1-445a-baf5-e5f0db6ad48d	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220716_안전_첨부10._수급인이_보유한_안전보호구_수량_4. 8BC 도급신고 제반 서류.xlsx	12848	Initial automated ingestion	\N	2026-03-28 15:26:46.259084
c239a66b-38b2-4096-9c31-9de2794e33ec	576abf5e-fae8-4b59-94f7-c324987272d3	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련.xlsx	165	Initial automated ingestion	\N	2026-03-28 15:26:46.21976
8dd97afd-6bfc-49df-8ebb-4c42dcb5ddc4	e5ee717f-e7a2-4e1e-b720-d4a0fe7ba886	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련_v1.xlsx	165	Initial automated ingestion	\N	2026-03-28 15:26:46.22089
205746a4-60dd-47a9-8da6-ccde30b8a301	8f88efaa-5d39-4da3-bfb8-89882ad14538	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230313_안전_[23년_공통]_안전보건교육_안내서(3월)_01.공통.pdf	3417233	Initial automated ingestion	\N	2026-03-28 15:26:46.569105
3cbeecfa-54b0-4bcf-a69d-cf4a4c4b500c	0161df01-635e-4219-815b-3d0faab0adba	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx	2153720	Initial automated ingestion	\N	2026-03-28 15:26:46.942992
d78ab5b0-8c62-4797-8ac1-63d81d349c84	925e47c2-3016-476c-9c1a-1be4f34c4ce1	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx	2153264	Initial automated ingestion	\N	2026-03-28 15:26:47.160554
a36880fc-d7d7-4c81-89b4-1db85b72ecfc	dbf554b9-aa1f-4f80-a79b-cb5c642762bf	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx	2153264	Initial automated ingestion	\N	2026-03-28 15:26:46.992844
01b115c8-05c8-49a4-8591-f7414614dc07	6e551deb-ac80-4ea6-97ff-7a72d51c1d1c	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250901_일보_공사일보(기흥어린이집철거)_25년_9월_1. 자체 작업일보_(이재춘).xlsx	1498897	Initial automated ingestion	\N	2026-03-28 15:26:46.817408
6342f14f-65af-4546-9b00-fd48d6e6900d	29f97d7d-c1ae-4047-bfc0-1f49449616b6	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250801_일보_공사일보(기흥어린이집철거)_25년_08월_1. 자체 작업일보_(이재춘).xlsx	1101373	Initial automated ingestion	\N	2026-03-28 15:26:46.789354
5bccc334-d917-474f-a092-4645d805656f	3e35bbf1-d91f-4870-83f2-607d4de99cb3	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250701_일보_공사일보(기흥어린이집철거)_25년_07월_1. 자체 작업일보_(이재춘).xlsx	749147	Initial automated ingestion	\N	2026-03-28 15:26:46.769545
ea0d7166-e7dd-4dd2-81ab-8dfe9ff04cb3	d3b7caee-9af9-4c94-ae33-3951b84c231f	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230823_보호구_[서식]_보호구_지급대장_04.서식.hwp	640512	Initial automated ingestion	\N	2026-03-28 15:26:46.311365
c36d4087-fa5f-4eb2-b517-10aac1710096	bc1ddfe4-d91b-4f01-af3d-ae6eda14965f	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230823_위험성_[서식]_승강기_위험성평가표,_주요사고사례_04.서식.hwp	490496	Initial automated ingestion	\N	2026-03-28 15:26:46.664745
2f610594-6475-473b-a5a0-8c71a686fc21	2055aeb4-4569-453e-91ad-5b3a5723d451	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230821_계획서_[서식]_굴착기_작업계획서_서식_표준안_04.서식.hwp	474624	Initial automated ingestion	\N	2026-03-28 15:26:46.709944
0acb3b3a-d4be-4071-92d2-a05ab374400b	d59397b7-17a3-4c8f-b4ec-bd2813ba5a61	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx	285898	Initial automated ingestion	\N	2026-03-28 15:26:46.335177
98e3b4df-28b1-4057-8c33-ee72585a2633	5b28964e-34d4-4bd6-95ff-bec9ffab6f67	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20230615_사진_고임목_사용기준_SDC_8B.jpg	236679	Initial automated ingestion	\N	2026-03-28 15:26:47.230694
f37852c0-375c-4259-8d09-6bbcbb5a55e5	06a92ebe-9351-43d8-9954-874f97da5dd5	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240327_사진_관리감독자_수료증_동춘월_(온라인_8hr)_1. 관리감독자 , 관리책임자.jpg	234728	Initial automated ingestion	\N	2026-03-28 15:26:47.238055
f6ad12dc-02c2-4aac-92eb-7aeaa3afd5d9	e3b3964e-fda1-432d-9f50-ee591c07446c	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231124_작업_[서식]_작업허가서_종류_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).pptx	148581	Initial automated ingestion	\N	2026-03-28 15:26:46.897926
ad2f535b-52f3-4023-9de9-dc03053f4795	de4afb62-4e01-4e02-a23d-faaea886a314	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231205_계획서_[서식]_차량계_건설기계_작업계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	129024	Initial automated ingestion	\N	2026-03-28 15:26:46.751581
1b649442-2348-4fe7-b589-a502bb88b309	be92640d-3ab5-4f1a-b75d-23e32d2b8ebc	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231021_계획서_[서식]_차량계하역운반기계등+작업계획서_작성(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	106496	Initial automated ingestion	\N	2026-03-28 15:26:46.731049
26645fc9-5b5d-478f-bdb1-df1092151511	95ba1bbe-17f3-4abf-b4aa-9da6c0d1cf95	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250429_허가서_A3_천정크레인_해체_반출인원_허가서_명단_크로스_250428_(1)_7. 허가서 명단 인원.xlsx	25805	Initial automated ingestion	\N	2026-03-28 15:26:46.904274
2d9f6d14-c2a5-46b9-9e6a-876f72f1db22	d07190dd-052f-4616-bab4-4d9f7a18bedd	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250513_작업_첨부_5-4-1_위험작업허가서_별거 다있음.docx	25002	Initial automated ingestion	\N	2026-03-28 15:26:46.906262
9d60bf2f-731f-47ea-aac4-469f0978f602	7ac902c9-9a1e-4798-b4ce-e17a2272ae91	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	24064	Initial automated ingestion	\N	2026-03-28 15:26:46.332817
cbe6861e-18ba-44fa-8212-c955dea9a61c	977a4dcf-bd6c-4280-81ac-e7e4875ca3aa	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250429_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1. 장비 체크리스트 및 명판.xlsx	21868	Initial automated ingestion	\N	2026-03-28 15:26:47.086811
ae2dab80-a954-4d79-992e-3bc68bdc0319	e1a1d1cf-4ea7-4457-bb71-91cdba3232ee	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20241108_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1.장비 체크리스트 및 명판.xlsx	21740	Initial automated ingestion	\N	2026-03-28 15:26:47.082879
39b452dc-1aef-4b27-a271-e03a805edb65	1c52042f-c30c-4d07-8c59-de308fa02e8f	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240926_장비_크로스특수_주식회사_장비반입_리스트(240926)2_2. 기타 자료.xlsx	21740	Initial automated ingestion	\N	2026-03-28 15:26:47.079793
c0e7cabc-61eb-4cc5-b62c-67f04b3bb0b1	1743d9cd-c53e-4b94-ae09-d337c2db1553	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20241106_공도구_8BC_공도구_제원_현황_List_240826(차대번호_포함)_SDC_8B.xlsx	19730	Initial automated ingestion	\N	2026-03-28 15:26:47.225287
4baef337-dfe3-48fa-aeed-8c2e5accba6e	cb7095af-0d75-4908-a57d-c3c57826ecc0	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231124_계획서_[서식]_중량물_취급_작업계획서(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	18944	Initial automated ingestion	\N	2026-03-28 15:26:46.740568
9046f842-1da4-4cc2-9cfd-c6a9897cd515	7c2e556a-18af-4266-9e65-8ce7b2706d18	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240805_작업_(라인전환TF)_8BC_FAB3,4_해체작업일보_크로스특수_240805_2. 기타 자료.xlsx	18348	Initial automated ingestion	\N	2026-03-28 15:26:46.76529
8c6f0ba1-b6e8-456c-9b53-0e84f2135b66	bba280b1-14fe-4049-bc2a-f925a620839b	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240827_장비_크로스_8BC_중장비_명판_부착_현황_24.11.10_2. 기타 자료.xlsx	15526	Initial automated ingestion	\N	2026-03-28 15:26:47.077049
dfcbb14d-e7cb-4660-8034-826f92c8ddea	e6ab3948-3818-4a04-a73f-fbc8663d3c5e	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20241014_작업_8BC_PJT_위험작업허가서_발급_대장_사인지_젠스엠_241012_2. 기타 자료.xlsx	13847	Initial automated ingestion	\N	2026-03-28 15:26:46.902651
f279b22d-73fd-4f9c-a84c-8d9ec0388932	575b0951-94c1-43f2-b28a-e199faf5e861	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20241227_장비_크로스특수_주식회사_장비반입_리스트(241227)_34. 중장비 점검 결과 및 반입 현황.xlsx	12609	Initial automated ingestion	\N	2026-03-28 15:26:47.084855
31e65e89-ec93-4860-a46d-b28303bc33f0	694dab3a-7015-4fba-a865-1547263e5c5e	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf	4893084	Initial automated ingestion	\N	2026-03-28 15:26:44.889388
9f8ac3d3-0925-451e-8b4a-497a91ad1a2e	248e7790-760c-4a02-bac4-33cfe5c879be	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf	4893084	Initial automated ingestion	\N	2026-03-28 15:26:46.345773
5e8eaaef-6ddc-4a02-bec1-4e62b0673671	899e34f4-036b-4646-b8d9-94ccbf189df0	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220409_교육_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업계획서_교안)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pptx	4087977	Initial automated ingestion	\N	2026-03-28 15:26:45.038014
4ead1545-35f9-4b5e-bab2-6a8590e1b843	a7c455d9-c78e-499d-9d55-82659a3983f2	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx	2153720	Initial automated ingestion	\N	2026-03-28 15:26:47.090403
66c4f844-f0f3-4cf1-afd3-f7cf5ee8fc5b	d46d3a4d-63e5-4d29-aba4-739a511cdea2	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록.pdf	918436	Initial automated ingestion	\N	2026-03-28 15:26:47.405696
dab769ba-f28d-41af-8f9b-f3e422bbf64a	10daa18b-19cf-4d32-ad94-f04c33cf9938	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록_v1.pdf	918436	Initial automated ingestion	\N	2026-03-28 15:26:47.441607
0ef4d153-ed93-45e2-b70f-4ff3ba5f0f99	2de46517-b3c0-4a25-9191-c686e12ceeab	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록_v1.pdf	914220	Initial automated ingestion	\N	2026-03-28 15:26:47.334411
e6a2f401-12b4-40fc-bc4c-b127f1c75b31	6867628d-2add-43ac-8472-544e45758bc2	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록.pdf	914220	Initial automated ingestion	\N	2026-03-28 15:26:47.285095
478e4cc7-9aba-49d4-b154-2be5b681499c	1638d75f-0a74-4826-8f16-f13638a15304	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20202501_안전_안전보건_경영방침_202501_진풍_18. 사무실 게시 서류.pdf	598786	Initial automated ingestion	\N	2026-03-28 15:26:46.496731
d191887a-86a3-40d5-a4ca-940845e43730	cf187f5e-6f8f-4c89-92f3-75425c3f9e6d	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20220715_사업자_첨부3._크로스특수_사업자등록증_4. 8BC 도급신고 제반 서류.jpg	484717	Initial automated ingestion	\N	2026-03-28 15:26:44.000885
73047682-2b4a-4031-895c-b6ea17f54e71	0ea23eee-6176-442a-9780-eb4b2c2d6f3f	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20251217_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.07_(인력)_251217_1. 결제 완료_(스캔본).pdf	444419	Initial automated ingestion	\N	2026-03-28 15:26:44.539842
cd0f4319-298e-4446-836b-c2a5127de4b1	64447fb0-c051-493c-ba37-af11218dddc4	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20250623_도면_기초도면_(10ROLL-좌타입)_슬러지박스_주문형_1000×2800_(삼성SDI)_(2)_23. 장비 작업 계획서.pdf	211006	Initial automated ingestion	\N	2026-03-28 15:26:46.932617
2b55a0ef-1eee-48bc-9ac7-0305b2f97e80	c4ab43ee-9eee-4652-bf02-8ce3346c71b9	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231206_선임_[서식]_안전관리자_선임보고(개정)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	125440	Initial automated ingestion	\N	2026-03-28 15:26:44.182605
96726cd9-02f7-4fb5-9778-f03c283695e9	77b97927-98a5-4c31-bbed-8e0d9a02e253	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240731_사진_박태리_관리감독자_수료증_(온라인)_1_1. 사진.jpg	105989	Initial automated ingestion	\N	2026-03-28 15:26:47.248512
b28dad9f-70c8-40a0-9bc0-b43008272e4f	45d1ba01-3966-4bbd-955f-755fac84e599	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240731_사진_이건식_관리감독자_수료증_(온라인)_1_1. 사진.jpg	105428	Initial automated ingestion	\N	2026-03-28 15:26:47.253108
0d2ea07e-8d58-4abe-8786-4656c7b8b1bb	082d6062-e19a-4a79-b37f-d6c921da0f3e	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240731_사진_권오형_관리감독자_수료증_(온라인)_1_1. 사진.jpg	81866	Initial automated ingestion	\N	2026-03-28 15:26:47.244489
1488ebbe-e51c-4d10-a533-701ae4850e38	7aba7633-4464-477c-b42c-b1f31fa4f354	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	24064	Initial automated ingestion	\N	2026-03-28 15:26:45.568618
9cb2d86d-40a3-46ee-8302-8da4bbbe9998	10e15040-7bb0-4074-83cf-b38d0060b052	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20231124_작업_[서식]_작업허가서(화기,_일반)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	20480	Initial automated ingestion	\N	2026-03-28 15:26:46.894619
15c9b8eb-d274-4a85-a9ab-15817f827bd5	082073f1-4acc-4a4d-9167-d9f4e8676fcc	v1.0	documents/e63249c5-365e-499f-aa01-c26778fe19c6/20240206_회의록_[서식]_Tool_Box_Meeting_회의록_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	14848	Initial automated ingestion	\N	2026-03-28 15:26:47.264081
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, project_id, category, sub_category, type, name, status, security_level, current_version, metadata, created_at, updated_at, locked_by, locked_at, locked_by_name) FROM stdin;
10daa18b-19cf-4d32-ad94-f04c33cf9938	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	PDF	20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록_v1.pdf	APPROVED	NORMAL	v1	{"tags": "����,����,�׽�Ʈ", "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록_v1.pdf", "official_name": "회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록_v1", "production_date": "2025-02-14"}	2026-03-28 15:26:47.441607	2026-03-28 19:00:43.893942	\N	\N	\N
1b4d824a-a29f-404c-846e-49ebdb2a246b	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	기술서류	03_선임_조직_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "03_선임_조직"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
b7b448fd-612f-4ca8-b71d-d8262860b366	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	기술서류	04_인력_출력_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "04_인력_출력"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
ae36c1da-33d7-4fba-851c-056db0f01597	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	05_내역_정산	기술서류	05_내역_정산_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "05_내역_정산"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
a69dd88c-d7f4-4d0d-be80-bc6ff4ef00f2	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	기술서류	02_위험성평가_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "02_위험성평가"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
d64c86fe-216c-4488-9d8a-069940501283	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	기술서류	03_안전점검_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "03_안전점검"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
ae442453-80c0-42db-81ef-23b49f736dcc	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	04_TBM_회의	기술서류	04_TBM_회의_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "04_TBM_회의"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
c794a507-9258-4714-bb72-f6d6f555ea3e	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	기술서류	05_보호구_장구_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "05_보호구_장구"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
4583bbeb-ff63-4894-a268-f64adb803d4b	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	기술서류	06_산업보건_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "06_산업보건"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
c9bea31c-9487-47cf-925e-1c30fd5f0db0	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	07_사고_사례	기술서류	07_사고_사례_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "07_사고_사례"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
8b3176e5-ea99-4d4d-9d33-af3e4f8bdd63	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	01_작업계획서	기술서류	01_작업계획서_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "01_작업계획서"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
3f97ca57-c51e-49f7-a772-28fee57c869f	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	02_시공계획서	기술서류	02_시공계획서_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "02_시공계획서"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
894cee31-2506-4907-9bdb-16d1ba5eb8d4	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	03_공사일보	기술서류	03_공사일보_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "03_공사일보"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
0f5b90ee-ccc1-4602-85cd-da0b7d702f67	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	기술서류	04_작업허가서_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "04_작업허가서"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
5b0be492-5f3f-446d-891a-64c487849338	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	05_도면_설계	기술서류	05_도면_설계_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "05_도면_설계"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
888bfa6c-6699-426a-851f-c4c621f3df9d	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	01_장비서류	기술서류	01_장비서류_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "01_장비서류"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
e31f823c-274a-4e62-80a9-657cf2c06e87	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	02_중장비_점검	기술서류	02_중장비_점검_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "02_중장비_점검"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
851ac435-95f9-4108-ac7e-9943aa983cfb	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	03_공도구_관리	기술서류	03_공도구_관리_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "03_공도구_관리"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
d6c2ef93-7574-469f-aa5f-b1ae44f06098	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	기술서류	01_사진대지_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "01_사진대지"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
b268ae6c-f242-4b24-a4ae-902decc3862f	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	02_공문_수발신	기술서류	02_공문_수발신_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "02_공문_수발신"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
6aa4b404-a828-4dd2-a88e-5372a001dc8f	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	기술서류	03_회의록_일반_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "03_회의록_일반"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
4775fd23-72f6-4602-9bba-72f7d6b978f5	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	04_준공_정산	기술서류	04_준공_정산_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "04_준공_정산"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
3a7fecfa-a5f0-4c91-9877-ee7fef4c486f	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	기술서류	02_계약_서약_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "02_계약_서약"}	2026-03-28 11:16:23.316713	2026-03-28 16:26:28.795722	\N	\N	\N
cf187f5e-6f8f-4c89-92f3-75425c3f9e6d	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	JPG	20220715_사업자_첨부3._크로스특수_사업자등록증_4. 8BC 도급신고 제반 서류.jpg	APPROVED	NORMAL	v1	{"tags": ["#공무", "#사업자"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20220715_사업자_첨부3._크로스특수_사업자등록증_4. 8BC 도급신고 제반 서류.jpg", "official_name": "사업자_첨부3._크로스특수_사업자등록증_4. 8BC 도급신고 제반 서류", "production_date": "2022-07-15"}	2026-03-28 15:26:44.000885	2026-03-28 16:26:28.795722	\N	\N	\N
87f70c86-a5d8-4502-a6fc-6722b6242531	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	기술서류	01_안전교육_샘플_문서.pdf	APPROVED	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "01_안전교육"}	2026-03-28 11:16:23.316713	2026-03-28 17:01:35.659926	\N	\N	\N
d9870386-58ce-41ab-9fa0-7bdbcd32d20e	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	기술서류	03_선임_조직_샘플_문서.pdf (Copy)	DRAFT	NORMAL	v1	{"size": "1.2MB", "type": "PDF", "vendor": "MOCK SYSTEM", "folderId": "01_사업자_면허", "client_submit": false}	2026-03-28 12:29:20.257927	2026-03-28 19:01:23.971857	\N	\N	\N
3555c763-5591-4515-abe6-5c577624b1f9	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	JPG	20230714_사업자_(주)원방_사업자등록증_(2023-07-14)_크레인 집게차(96거5789).jpg	APPROVED	NORMAL	v1	{"tags": ["#공무", "#사업자"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20230714_사업자_(주)원방_사업자등록증_(2023-07-14)_크레인 집게차(96거5789).jpg", "official_name": "사업자_(주)원방_사업자등록증_(2023-07-14)_크레인 집게차(96거5789)", "production_date": "2023-07-14"}	2026-03-28 15:26:44.019174	2026-03-28 16:26:28.795722	\N	\N	\N
061ac33a-3c02-47b5-89a7-6c6f88e631df	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	PDF	20231211_사업자_크로스특수_사업자등록증_10. 화관법 도급신고.pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#사업자"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20231211_사업자_크로스특수_사업자등록증_10. 화관법 도급신고.pdf", "official_name": "사업자_크로스특수_사업자등록증_10. 화관법 도급신고", "production_date": "2023-12-11"}	2026-03-28 15:26:44.035839	2026-03-28 16:26:28.795722	\N	\N	\N
82aeea9e-ac5c-46b3-b440-e8a845d11d3f	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	PDF	20231211_사업자_크로스특수_사업자등록증_2. 도급 신고 서류.pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#사업자"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20231211_사업자_크로스특수_사업자등록증_2. 도급 신고 서류.pdf", "official_name": "사업자_크로스특수_사업자등록증_2. 도급 신고 서류", "production_date": "2023-12-11"}	2026-03-28 15:26:44.04833	2026-03-28 16:26:28.795722	\N	\N	\N
f235d7fe-5159-4650-bb6f-beccf7ef4616	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	01_사업자_면허	PDF	20240722_사업자_온세이프티_사업자등록증_관리감독자.pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#사업자"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240722_사업자_온세이프티_사업자등록증_관리감독자.pdf", "official_name": "사업자_온세이프티_사업자등록증_관리감독자", "production_date": "2024-07-22"}	2026-03-28 15:26:44.100712	2026-03-28 16:26:28.795722	\N	\N	\N
87f54b2f-7eee-4074-9121-711597f15411	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	PDF	20240620_계약_업체명_위탁계약서_및_개인정보활용동의서(240620)_관리감독자.pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#계약"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240620_계약_업체명_위탁계약서_및_개인정보활용동의서(240620)_관리감독자.pdf", "official_name": "계약_업체명_위탁계약서_및_개인정보활용동의서(240620)_관리감독자", "production_date": "2024-06-20"}	2026-03-28 15:26:44.134032	2026-03-28 16:26:28.795722	\N	\N	\N
c1f63a66-2447-4e4e-8211-4a3b28f9eb41	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	HWP	20240722_계약_위탁계약서_및_개인정보활용동의서_관리감독자.hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#계약"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240722_계약_위탁계약서_및_개인정보활용동의서_관리감독자.hwp", "official_name": "계약_위탁계약서_및_개인정보활용동의서_관리감독자", "production_date": "2024-07-22"}	2026-03-28 15:26:44.147043	2026-03-28 16:26:28.795722	\N	\N	\N
8b1b5ff0-4ab6-43c6-9463-de9e8cefacd9	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	XLSX	20250601_계약_06.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#계약"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20250601_계약_06.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx", "official_name": "계약_06.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서", "production_date": "2025-06-01"}	2026-03-28 15:26:44.153359	2026-03-28 16:26:28.795722	\N	\N	\N
6789aace-2e9f-4aa0-90a6-c7eee74fafdd	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	XLSX	20250701_계약_07.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#계약"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20250701_계약_07.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx", "official_name": "계약_07.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서", "production_date": "2025-07-01"}	2026-03-28 15:26:44.158347	2026-03-28 16:26:28.795722	\N	\N	\N
f87888ed-07f4-45f9-97e4-e213b898a178	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	02_계약_서약	XLSX	20250801_계약_08.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#계약"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20250801_계약_08.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서.xlsx", "official_name": "계약_08.01_수정-(2025년)12.1만_일용근로자_근로계약서_엑셀_수정분_(신규근로자_및_신규현장)_3. 근로계약서", "production_date": "2025-08-01"}	2026-03-28 15:26:44.164167	2026-03-28 16:26:28.795722	\N	\N	\N
c4ab43ee-9eee-4652-bf02-8ce3346c71b9	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	HWP	20231206_선임_[서식]_안전관리자_선임보고(개정)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#선임"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20231206_선임_[서식]_안전관리자_선임보고(개정)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "선임_[서식]_안전관리자_선임보고(개정)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-12-06"}	2026-03-28 15:26:44.182605	2026-03-28 16:26:28.795722	\N	\N	\N
4c5dfe0a-85bb-429a-98ee-85a1adb4dbe6	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	HWP	20231209_선임_[서식]_안전보건총괄_및_관리책임자_선임서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#선임"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20231209_선임_[서식]_안전보건총괄_및_관리책임자_선임서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "선임_[서식]_안전보건총괄_및_관리책임자_선임서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-12-09"}	2026-03-28 15:26:44.190585	2026-03-28 16:26:28.795722	\N	\N	\N
8add98b1-3f59-4bf9-8dd4-99e87981abfe	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	HWP	20240411_선임_안전관리자_선임보고서(건설업)_양식_1-5. 안전관리자 선임 서류.hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#선임"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240411_선임_안전관리자_선임보고서(건설업)_양식_1-5. 안전관리자 선임 서류.hwp", "official_name": "선임_안전관리자_선임보고서(건설업)_양식_1-5. 안전관리자 선임 서류", "production_date": "2024-04-11"}	2026-03-28 15:26:44.199026	2026-03-28 16:26:28.795722	\N	\N	\N
e4455bef-49bc-4a52-970b-b053f7e3b350	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	XLSX	20240724_선임_1_1._안전보건총괄책임자_선임서_SAMPLE_7_1. 안전보건총괄책임자.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#선임"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240724_선임_1_1._안전보건총괄책임자_선임서_SAMPLE_7_1. 안전보건총괄책임자.xlsx", "official_name": "선임_1_1._안전보건총괄책임자_선임서_SAMPLE_7_1. 안전보건총괄책임자", "production_date": "2024-07-24"}	2026-03-28 15:26:44.203193	2026-03-28 16:26:28.795722	\N	\N	\N
1cf9c203-b5fa-4ce9-83f9-a2308a861884	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	03_선임_조직	XLSX	20240725_선임_2_1._안전보건관리책임자_선임서_SAMPLE_7_2. 안전보건관리책임자.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#선임"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20240725_선임_2_1._안전보건관리책임자_선임서_SAMPLE_7_2. 안전보건관리책임자.xlsx", "official_name": "선임_2_1._안전보건관리책임자_선임서_SAMPLE_7_2. 안전보건관리책임자", "production_date": "2024-07-25"}	2026-03-28 15:26:44.20503	2026-03-28 16:26:28.795722	\N	\N	\N
8e1244c2-d83e-4af6-a5af-d54e492dc1ee	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	HWP	20230315_인력_[서식]_안전예산편성,안전보건_전문인력_평가표_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#인력"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20230315_인력_[서식]_안전예산편성,안전보건_전문인력_평가표_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "인력_[서식]_안전예산편성,안전보건_전문인력_평가표_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-03-15"}	2026-03-28 15:26:44.211046	2026-03-28 16:26:28.795722	\N	\N	\N
1d7a1c78-ee70-4105-a1fc-a3e44f704413	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	PDF	20250708_인력_운반용_중량물_취급계획서_(인력)_250708_1. 결제 완료_(스캔본).pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#인력"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20250708_인력_운반용_중량물_취급계획서_(인력)_250708_1. 결제 완료_(스캔본).pdf", "official_name": "인력_운반용_중량물_취급계획서_(인력)_250708_1. 결제 완료_(스캔본)", "production_date": "2025-07-08"}	2026-03-28 15:26:44.220332	2026-03-28 16:26:28.795722	\N	\N	\N
b685a9d7-fa22-4f37-aa1b-6e80482e935a	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	PDF	20250909_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.04_(인력)_250908_1. 결제 완료_(스캔본).pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#인력"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20250909_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.04_(인력)_250908_1. 결제 완료_(스캔본).pdf", "official_name": "인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.04_(인력)_250908_1. 결제 완료_(스캔본)", "production_date": "2025-09-09"}	2026-03-28 15:26:44.236354	2026-03-28 16:26:28.795722	\N	\N	\N
ace21f98-254a-4552-8265-9dd79e127e33	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	PDF	20251020_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.05_(인력)_251020_1. 결제 완료_(스캔본).pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#인력"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20251020_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.05_(인력)_251020_1. 결제 완료_(스캔본).pdf", "official_name": "인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.05_(인력)_251020_1. 결제 완료_(스캔본)", "production_date": "2025-10-20"}	2026-03-28 15:26:44.4639	2026-03-28 16:26:28.795722	\N	\N	\N
0ea23eee-6176-442a-9780-eb4b2c2d6f3f	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	04_인력_출력	PDF	20251217_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.07_(인력)_251217_1. 결제 완료_(스캔본).pdf	APPROVED	NORMAL	v1	{"tags": ["#공무", "#인력"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20251217_인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.07_(인력)_251217_1. 결제 완료_(스캔본).pdf", "official_name": "인력_[GH_FAB_마감공사_개보수]_제이아이엔피_운반용_중량물_취급계획서_Rev.07_(인력)_251217_1. 결제 완료_(스캔본)", "production_date": "2025-12-17"}	2026-03-28 15:26:44.539842	2026-03-28 16:26:28.795722	\N	\N	\N
cf90a009-4aaa-4b8f-a213-f60d2115ee51	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	05_내역_정산	HWP	20231129_내역서_[서식]_안전보건관리비_사용내역서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공무", "#내역"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20231129_내역서_[서식]_안전보건관리비_사용내역서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "내역서_[서식]_안전보건관리비_사용내역서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-11-29"}	2026-03-28 15:26:44.55829	2026-03-28 16:26:28.795722	\N	\N	\N
f111370e-bd9c-470f-af67-23163f723611	e63249c5-365e-499f-aa01-c26778fe19c6	00_공무_행정	05_내역_정산	XLSX	20251021_내역서_(크로스)안전보건관리비_사용내역서_2508월_⑨안전관리비_기흥SR5,CDI철거현장(월).xlsx	APPROVED	NORMAL	v1	{"tags": ["#공무", "#내역"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\00_공무_행정\\\\20251021_내역서_(크로스)안전보건관리비_사용내역서_2508월_⑨안전관리비_기흥SR5,CDI철거현장(월).xlsx", "official_name": "내역서_(크로스)안전보건관리비_사용내역서_2508월_⑨안전관리비_기흥SR5,CDI철거현장(월)", "production_date": "2025-10-21"}	2026-03-28 15:26:44.571578	2026-03-28 16:26:28.795722	\N	\N	\N
694dab3a-7015-4fba-a865-1547263e5c5e	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	PDF	20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전교육"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf", "official_name": "안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육", "production_date": "2020-24-05"}	2026-03-28 15:26:44.889388	2026-03-28 16:26:28.795722	\N	\N	\N
e3fedf6b-339c-43a4-8993-080e931b5c87	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	HWP	20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전점검"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2011-09-02"}	2026-03-28 15:26:45.695617	2026-03-28 16:26:28.795722	\N	\N	\N
899e34f4-036b-4646-b8d9-94ccbf189df0	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	PPTX	20220409_교육_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업계획서_교안)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pptx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전교육"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220409_교육_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업계획서_교안)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pptx", "official_name": "교육_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업계획서_교안)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업", "production_date": "2022-04-09"}	2026-03-28 15:26:45.038014	2026-03-28 16:26:28.795722	\N	\N	\N
e79e2d93-bda8-4e53-a667-ca67b816a20d	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	PDF	20220409_교육_(특별교육)29.콘크리트인공구조물의_해체_또는_파괴작업(트리니트로톨루엔(TNT))_29번_(특별교육)콘크리트인공구조물의 해체 또는 파괴작업.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전교육"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220409_교육_(특별교육)29.콘크리트인공구조물의_해체_또는_파괴작업(트리니트로톨루엔(TNT))_29번_(특별교육)콘크리트인공구조물의 해체 또는 파괴작업.pdf", "official_name": "교육_(특별교육)29.콘크리트인공구조물의_해체_또는_파괴작업(트리니트로톨루엔(TNT))_29번_(특별교육)콘크리트인공구조물의 해체 또는 파괴작업", "production_date": "2022-04-09"}	2026-03-28 15:26:45.354137	2026-03-28 16:26:28.795722	\N	\N	\N
6741fb17-8118-413d-acab-9e1dfd1b8880	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	PDF	20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전교육"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf", "official_name": "안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(굴착작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업", "production_date": "2022-04-09"}	2026-03-28 15:26:45.469724	2026-03-28 16:26:28.795722	\N	\N	\N
c0a077c1-74c3-45f7-9fe2-73ffbf9f442e	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	01_안전교육	PDF	20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(토목작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전교육"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220409_안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(토목작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업.pdf", "official_name": "안전_(특별교육)19.굴착면의_높이가2미터_이상이_되는_지반굴착작업_(토목작업안전)_19번_(특별교육)굴착면의 높이가2미터 이상이 되는 지반굴착작업", "production_date": "2022-04-09"}	2026-03-28 15:26:45.517246	2026-03-28 16:26:28.795722	\N	\N	\N
7aba7633-4464-477c-b42c-b1f31fa4f354	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	HWP	20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#위험성평가"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2011-09-02"}	2026-03-28 15:26:45.568618	2026-03-28 16:26:28.795722	\N	\N	\N
1b303ffb-aade-4335-a4be-3df9d07e46ae	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	XLS	20121207_안전_KRA_48.안전가시설_작업_위험성평가 가이드.xls	APPROVED	NORMAL	v1	{"tags": ["#안전", "#위험성평가"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20121207_안전_KRA_48.안전가시설_작업_위험성평가 가이드.xls", "official_name": "안전_KRA_48.안전가시설_작업_위험성평가 가이드", "production_date": "2012-12-07"}	2026-03-28 15:26:45.587443	2026-03-28 16:26:28.795722	\N	\N	\N
e62ea67a-8004-4b9d-b4f9-d0c5979c4aa8	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	XLSX	20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#위험성평가"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx", "official_name": "안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2016-09-29"}	2026-03-28 15:26:45.643731	2026-03-28 16:26:28.795722	\N	\N	\N
b0e3b2d4-3ded-4835-b470-5caab37f9dcd	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	HWP	20230315_안전_[서식]_안전보건경영방침,안전계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#위험성평가"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230315_안전_[서식]_안전보건경영방침,안전계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "안전_[서식]_안전보건경영방침,안전계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-03-15"}	2026-03-28 15:26:45.682079	2026-03-28 16:26:28.795722	\N	\N	\N
054f44e3-a20c-40be-b632-fa10d9209da4	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	02_위험성평가	HWP	20230315_안전_[서식]_연간_안전교육_계획_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#위험성평가"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230315_안전_[서식]_연간_안전교육_계획_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "안전_[서식]_연간_안전교육_계획_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-03-15"}	2026-03-28 15:26:45.689356	2026-03-28 16:26:28.795722	\N	\N	\N
248607bb-1e2e-4e66-9a9c-f1e1fdb639c4	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	PPTX	20230315_점검_(3-3-0)_교량점검로_설치_작업_3.토목공사.pptx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전점검"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230315_점검_(3-3-0)_교량점검로_설치_작업_3.토목공사.pptx", "official_name": "점검_(3-3-0)_교량점검로_설치_작업_3.토목공사", "production_date": "2023-03-15"}	2026-03-28 15:26:45.707894	2026-03-28 16:26:28.795722	\N	\N	\N
46aaa415-6b95-4424-a9a1-b43e573dac05	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	PDF	20230327_안전_[21년_건설]_안전보건관리체계_자율점검표(1월)_안전보건공단_02.건설업.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전점검"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230327_안전_[21년_건설]_안전보건관리체계_자율점검표(1월)_안전보건공단_02.건설업.pdf", "official_name": "안전_[21년_건설]_안전보건관리체계_자율점검표(1월)_안전보건공단_02.건설업", "production_date": "2023-03-27"}	2026-03-28 15:26:46.063743	2026-03-28 16:26:28.795722	\N	\N	\N
856673c6-552d-4ad2-a6af-4577092299a0	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	PDF	20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_건설_04.서식.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전점검"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_건설_04.서식.pdf", "official_name": "점검_[서식]_자율점검표(고위험_기인물_12종)_건설_04.서식", "production_date": "2023-04-11"}	2026-03-28 15:26:46.137303	2026-03-28 16:26:28.795722	\N	\N	\N
f3fc94cd-1a40-4ae0-a4da-e9153d7c2261	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	03_안전점검	PDF	20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_제조_04.서식.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#안전점검"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230411_점검_[서식]_자율점검표(고위험_기인물_12종)_제조_04.서식.pdf", "official_name": "점검_[서식]_자율점검표(고위험_기인물_12종)_제조_04.서식", "production_date": "2023-04-11"}	2026-03-28 15:26:46.162717	2026-03-28 16:26:28.795722	\N	\N	\N
4d678fd9-d6f1-4876-8a28-fd5481eb2e59	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	04_TBM_회의	PPTX	20230315_TBM_(3-34-0)_TBM터널_굴착_작업_3.토목공사.pptx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#TBM"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230315_TBM_(3-34-0)_TBM터널_굴착_작업_3.토목공사.pptx", "official_name": "TBM_(3-34-0)_TBM터널_굴착_작업_3.토목공사", "production_date": "2023-03-15"}	2026-03-28 15:26:46.191912	2026-03-28 16:26:28.795722	\N	\N	\N
576abf5e-fae8-4b59-94f7-c324987272d3	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	04_TBM_회의	XLSX	20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련.xlsx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#TBM"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련.xlsx", "official_name": "안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련", "production_date": "2024-07-18"}	2026-03-28 15:26:46.21976	2026-03-28 16:26:28.795722	\N	\N	\N
e5ee717f-e7a2-4e1e-b720-d4a0fe7ba886	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	04_TBM_회의	XLSX	20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련_v1.xlsx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#TBM"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20240718_안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련_v1.xlsx", "official_name": "안전_~$8BC_TBM_및_일일안전교욱_Sheet_rev.1_3. TMB 관련_v1", "production_date": "2024-07-18"}	2026-03-28 15:26:46.22089	2026-03-28 16:26:28.795722	\N	\N	\N
24eaf759-36d3-4922-8589-94ef88b986c0	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	PDF	20220714_안전_첨부7._안전보호구_착용_및_관리_규정_4. 8BC 도급신고 제반 서류.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#보호구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220714_안전_첨부7._안전보호구_착용_및_관리_규정_4. 8BC 도급신고 제반 서류.pdf", "official_name": "안전_첨부7._안전보호구_착용_및_관리_규정_4. 8BC 도급신고 제반 서류", "production_date": "2022-07-14"}	2026-03-28 15:26:46.231351	2026-03-28 16:26:28.795722	\N	\N	\N
c2ea916e-1021-48cc-b3b9-cdec270db51b	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	PDF	20220715_안전_첨부9._안전보호구_지급대장_4. 8BC 도급신고 제반 서류.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#보호구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220715_안전_첨부9._안전보호구_지급대장_4. 8BC 도급신고 제반 서류.pdf", "official_name": "안전_첨부9._안전보호구_지급대장_4. 8BC 도급신고 제반 서류", "production_date": "2022-07-15"}	2026-03-28 15:26:46.243374	2026-03-28 16:26:28.795722	\N	\N	\N
fc2acb65-bdd1-445a-baf5-e5f0db6ad48d	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	XLSX	20220716_안전_첨부10._수급인이_보유한_안전보호구_수량_4. 8BC 도급신고 제반 서류.xlsx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#보호구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20220716_안전_첨부10._수급인이_보유한_안전보호구_수량_4. 8BC 도급신고 제반 서류.xlsx", "official_name": "안전_첨부10._수급인이_보유한_안전보호구_수량_4. 8BC 도급신고 제반 서류", "production_date": "2022-07-16"}	2026-03-28 15:26:46.259084	2026-03-28 16:26:28.795722	\N	\N	\N
e19f8838-1714-4075-99ef-42247399f826	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	HWP	20230823_보호구_[서식]_보호구_밀착도_검사시트_04.서식.hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#보호구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230823_보호구_[서식]_보호구_밀착도_검사시트_04.서식.hwp", "official_name": "보호구_[서식]_보호구_밀착도_검사시트_04.서식", "production_date": "2023-08-23"}	2026-03-28 15:26:46.265017	2026-03-28 16:26:28.795722	\N	\N	\N
d3b7caee-9af9-4c94-ae33-3951b84c231f	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	05_보호구_장구	HWP	20230823_보호구_[서식]_보호구_지급대장_04.서식.hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#보호구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230823_보호구_[서식]_보호구_지급대장_04.서식.hwp", "official_name": "보호구_[서식]_보호구_지급대장_04.서식", "production_date": "2023-08-23"}	2026-03-28 15:26:46.311365	2026-03-28 16:26:28.795722	\N	\N	\N
7ac902c9-9a1e-4798-b4ce-e17a2272ae91	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	HWP	20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#산업보건"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20110902_점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "점검_[서식]_작업장_순회_점검_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2011-09-02"}	2026-03-28 15:26:46.332817	2026-03-28 16:26:28.795722	\N	\N	\N
d59397b7-17a3-4c8f-b4ec-bd2813ba5a61	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	XLSX	20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx	APPROVED	NORMAL	v1	{"tags": ["#안전", "#산업보건"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20160929_안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).xlsx", "official_name": "안전_[서식]_안전_일지_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2016-09-29"}	2026-03-28 15:26:46.335177	2026-03-28 16:26:28.795722	\N	\N	\N
248e7790-760c-4a02-bac4-33cfe5c879be	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	PDF	20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#산업보건"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20202405_안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육.pdf", "official_name": "안전_1_1._SDC안전보건정보제공_기본지키기_202405_교재_1. SDC 기본지키기교육", "production_date": "2020-24-05"}	2026-03-28 15:26:46.345773	2026-03-28 16:26:28.795722	\N	\N	\N
1638d75f-0a74-4826-8f16-f13638a15304	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	PDF	20202501_안전_안전보건_경영방침_202501_진풍_18. 사무실 게시 서류.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#산업보건"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20202501_안전_안전보건_경영방침_202501_진풍_18. 사무실 게시 서류.pdf", "official_name": "안전_안전보건_경영방침_202501_진풍_18. 사무실 게시 서류", "production_date": "2020-25-01"}	2026-03-28 15:26:46.496731	2026-03-28 16:26:28.795722	\N	\N	\N
8f88efaa-5d39-4da3-bfb8-89882ad14538	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	06_산업보건	PDF	20230313_안전_[23년_공통]_안전보건교육_안내서(3월)_01.공통.pdf	APPROVED	NORMAL	v1	{"tags": ["#안전", "#산업보건"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230313_안전_[23년_공통]_안전보건교육_안내서(3월)_01.공통.pdf", "official_name": "안전_[23년_공통]_안전보건교육_안내서(3월)_01.공통", "production_date": "2023-03-13"}	2026-03-28 15:26:46.569105	2026-03-28 16:26:28.795722	\N	\N	\N
bc1ddfe4-d91b-4f01-af3d-ae6eda14965f	e63249c5-365e-499f-aa01-c26778fe19c6	01_안전_보건	07_사고_사례	HWP	20230823_위험성_[서식]_승강기_위험성평가표,_주요사고사례_04.서식.hwp	APPROVED	NORMAL	v1	{"tags": ["#안전", "#사고"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\01_안전_보건\\\\20230823_위험성_[서식]_승강기_위험성평가표,_주요사고사례_04.서식.hwp", "official_name": "위험성_[서식]_승강기_위험성평가표,_주요사고사례_04.서식", "production_date": "2023-08-23"}	2026-03-28 15:26:46.664745	2026-03-28 16:26:28.795722	\N	\N	\N
2055aeb4-4569-453e-91ad-5b3a5723d451	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	01_작업계획서	HWP	20230821_계획서_[서식]_굴착기_작업계획서_서식_표준안_04.서식.hwp	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업계획서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20230821_계획서_[서식]_굴착기_작업계획서_서식_표준안_04.서식.hwp", "official_name": "계획서_[서식]_굴착기_작업계획서_서식_표준안_04.서식", "production_date": "2023-08-21"}	2026-03-28 15:26:46.709944	2026-03-28 16:26:28.795722	\N	\N	\N
be92640d-3ab5-4f1a-b75d-23e32d2b8ebc	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	01_작업계획서	HWP	20231021_계획서_[서식]_차량계하역운반기계등+작업계획서_작성(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업계획서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20231021_계획서_[서식]_차량계하역운반기계등+작업계획서_작성(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "계획서_[서식]_차량계하역운반기계등+작업계획서_작성(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-10-21"}	2026-03-28 15:26:46.731049	2026-03-28 16:26:28.795722	\N	\N	\N
cb7095af-0d75-4908-a57d-c3c57826ecc0	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	01_작업계획서	HWP	20231124_계획서_[서식]_중량물_취급_작업계획서(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업계획서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20231124_계획서_[서식]_중량물_취급_작업계획서(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "계획서_[서식]_중량물_취급_작업계획서(예시)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-11-24"}	2026-03-28 15:26:46.740568	2026-03-28 16:26:28.795722	\N	\N	\N
de4afb62-4e01-4e02-a23d-faaea886a314	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	01_작업계획서	HWP	20231205_계획서_[서식]_차량계_건설기계_작업계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업계획서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20231205_계획서_[서식]_차량계_건설기계_작업계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "계획서_[서식]_차량계_건설기계_작업계획서_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-12-05"}	2026-03-28 15:26:46.751581	2026-03-28 16:26:28.795722	\N	\N	\N
7c2e556a-18af-4266-9e65-8ce7b2706d18	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	03_공사일보	XLSX	20240805_작업_(라인전환TF)_8BC_FAB3,4_해체작업일보_크로스특수_240805_2. 기타 자료.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#공사일보"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20240805_작업_(라인전환TF)_8BC_FAB3,4_해체작업일보_크로스특수_240805_2. 기타 자료.xlsx", "official_name": "작업_(라인전환TF)_8BC_FAB3,4_해체작업일보_크로스특수_240805_2. 기타 자료", "production_date": "2024-08-05"}	2026-03-28 15:26:46.76529	2026-03-28 16:26:28.795722	\N	\N	\N
3e35bbf1-d91f-4870-83f2-607d4de99cb3	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	03_공사일보	XLSX	20250701_일보_공사일보(기흥어린이집철거)_25년_07월_1. 자체 작업일보_(이재춘).xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#공사일보"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250701_일보_공사일보(기흥어린이집철거)_25년_07월_1. 자체 작업일보_(이재춘).xlsx", "official_name": "일보_공사일보(기흥어린이집철거)_25년_07월_1. 자체 작업일보_(이재춘)", "production_date": "2025-07-01"}	2026-03-28 15:26:46.769545	2026-03-28 16:26:28.795722	\N	\N	\N
29f97d7d-c1ae-4047-bfc0-1f49449616b6	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	03_공사일보	XLSX	20250801_일보_공사일보(기흥어린이집철거)_25년_08월_1. 자체 작업일보_(이재춘).xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#공사일보"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250801_일보_공사일보(기흥어린이집철거)_25년_08월_1. 자체 작업일보_(이재춘).xlsx", "official_name": "일보_공사일보(기흥어린이집철거)_25년_08월_1. 자체 작업일보_(이재춘)", "production_date": "2025-08-01"}	2026-03-28 15:26:46.789354	2026-03-28 16:26:28.795722	\N	\N	\N
6e551deb-ac80-4ea6-97ff-7a72d51c1d1c	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	03_공사일보	XLSX	20250901_일보_공사일보(기흥어린이집철거)_25년_9월_1. 자체 작업일보_(이재춘).xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#공사일보"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250901_일보_공사일보(기흥어린이집철거)_25년_9월_1. 자체 작업일보_(이재춘).xlsx", "official_name": "일보_공사일보(기흥어린이집철거)_25년_9월_1. 자체 작업일보_(이재춘)", "production_date": "2025-09-01"}	2026-03-28 15:26:46.817408	2026-03-28 16:26:28.795722	\N	\N	\N
10e15040-7bb0-4074-83cf-b38d0060b052	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	HWP	20231124_작업_[서식]_작업허가서(화기,_일반)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업허가서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20231124_작업_[서식]_작업허가서(화기,_일반)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "작업_[서식]_작업허가서(화기,_일반)_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-11-24"}	2026-03-28 15:26:46.894619	2026-03-28 16:26:28.795722	\N	\N	\N
e3b3964e-fda1-432d-9f50-ee591c07446c	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	PPTX	20231124_작업_[서식]_작업허가서_종류_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).pptx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업허가서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20231124_작업_[서식]_작업허가서_종류_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).pptx", "official_name": "작업_[서식]_작업허가서_종류_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2023-11-24"}	2026-03-28 15:26:46.897926	2026-03-28 16:26:28.795722	\N	\N	\N
e6ab3948-3818-4a04-a73f-fbc8663d3c5e	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	XLSX	20241014_작업_8BC_PJT_위험작업허가서_발급_대장_사인지_젠스엠_241012_2. 기타 자료.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업허가서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20241014_작업_8BC_PJT_위험작업허가서_발급_대장_사인지_젠스엠_241012_2. 기타 자료.xlsx", "official_name": "작업_8BC_PJT_위험작업허가서_발급_대장_사인지_젠스엠_241012_2. 기타 자료", "production_date": "2024-10-14"}	2026-03-28 15:26:46.902651	2026-03-28 16:26:28.795722	\N	\N	\N
95ba1bbe-17f3-4abf-b4aa-9da6c0d1cf95	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	XLSX	20250429_허가서_A3_천정크레인_해체_반출인원_허가서_명단_크로스_250428_(1)_7. 허가서 명단 인원.xlsx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업허가서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250429_허가서_A3_천정크레인_해체_반출인원_허가서_명단_크로스_250428_(1)_7. 허가서 명단 인원.xlsx", "official_name": "허가서_A3_천정크레인_해체_반출인원_허가서_명단_크로스_250428_(1)_7. 허가서 명단 인원", "production_date": "2025-04-29"}	2026-03-28 15:26:46.904274	2026-03-28 16:26:28.795722	\N	\N	\N
d07190dd-052f-4616-bab4-4d9f7a18bedd	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	04_작업허가서	DOCX	20250513_작업_첨부_5-4-1_위험작업허가서_별거 다있음.docx	APPROVED	NORMAL	v1	{"tags": ["#공사", "#작업허가서"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250513_작업_첨부_5-4-1_위험작업허가서_별거 다있음.docx", "official_name": "작업_첨부_5-4-1_위험작업허가서_별거 다있음", "production_date": "2025-05-13"}	2026-03-28 15:26:46.906262	2026-03-28 16:26:28.795722	\N	\N	\N
64447fb0-c051-493c-ba37-af11218dddc4	e63249c5-365e-499f-aa01-c26778fe19c6	02_공사_작업	05_도면_설계	PDF	20250623_도면_기초도면_(10ROLL-좌타입)_슬러지박스_주문형_1000×2800_(삼성SDI)_(2)_23. 장비 작업 계획서.pdf	APPROVED	NORMAL	v1	{"tags": ["#공사", "#도면"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\02_공사_작업\\\\20250623_도면_기초도면_(10ROLL-좌타입)_슬러지박스_주문형_1000×2800_(삼성SDI)_(2)_23. 장비 작업 계획서.pdf", "official_name": "도면_기초도면_(10ROLL-좌타입)_슬러지박스_주문형_1000×2800_(삼성SDI)_(2)_23. 장비 작업 계획서", "production_date": "2025-06-23"}	2026-03-28 15:26:46.932617	2026-03-28 16:26:28.795722	\N	\N	\N
0161df01-635e-4219-815b-3d0faab0adba	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	01_장비서류	XLSX	20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#장비서류"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx", "official_name": "장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트", "production_date": "2024-07-18"}	2026-03-28 15:26:46.942992	2026-03-28 16:26:28.795722	\N	\N	\N
dbf554b9-aa1f-4f80-a79b-cb5c642762bf	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	01_장비서류	XLSX	20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#장비서류"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx", "official_name": "장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정", "production_date": "2024-07-29"}	2026-03-28 15:26:46.992844	2026-03-28 16:26:28.795722	\N	\N	\N
bba280b1-14fe-4049-bc2a-f925a620839b	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	01_장비서류	XLSX	20240827_장비_크로스_8BC_중장비_명판_부착_현황_24.11.10_2. 기타 자료.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#장비서류"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240827_장비_크로스_8BC_중장비_명판_부착_현황_24.11.10_2. 기타 자료.xlsx", "official_name": "장비_크로스_8BC_중장비_명판_부착_현황_24.11.10_2. 기타 자료", "production_date": "2024-08-27"}	2026-03-28 15:26:47.077049	2026-03-28 16:26:28.795722	\N	\N	\N
1c52042f-c30c-4d07-8c59-de308fa02e8f	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	01_장비서류	XLSX	20240926_장비_크로스특수_주식회사_장비반입_리스트(240926)2_2. 기타 자료.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#장비서류"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240926_장비_크로스특수_주식회사_장비반입_리스트(240926)2_2. 기타 자료.xlsx", "official_name": "장비_크로스특수_주식회사_장비반입_리스트(240926)2_2. 기타 자료", "production_date": "2024-09-26"}	2026-03-28 15:26:47.079793	2026-03-28 16:26:28.795722	\N	\N	\N
e1a1d1cf-4ea7-4457-bb71-91cdba3232ee	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	02_중장비_점검	XLSX	20241108_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1.장비 체크리스트 및 명판.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#중장비"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20241108_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1.장비 체크리스트 및 명판.xlsx", "official_name": "장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1.장비 체크리스트 및 명판", "production_date": "2024-11-08"}	2026-03-28 15:26:47.082879	2026-03-28 16:26:28.795722	\N	\N	\N
575b0951-94c1-43f2-b28a-e199faf5e861	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	02_중장비_점검	XLSX	20241227_장비_크로스특수_주식회사_장비반입_리스트(241227)_34. 중장비 점검 결과 및 반입 현황.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#중장비"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20241227_장비_크로스특수_주식회사_장비반입_리스트(241227)_34. 중장비 점검 결과 및 반입 현황.xlsx", "official_name": "장비_크로스특수_주식회사_장비반입_리스트(241227)_34. 중장비 점검 결과 및 반입 현황", "production_date": "2024-12-27"}	2026-03-28 15:26:47.084855	2026-03-28 16:26:28.795722	\N	\N	\N
977a4dcf-bd6c-4280-81ac-e7e4875ca3aa	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	02_중장비_점검	XLSX	20250429_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1. 장비 체크리스트 및 명판.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#중장비"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20250429_장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1. 장비 체크리스트 및 명판.xlsx", "official_name": "장비_크로스_중장비_명판_양식_및_부착현황_24.11.11_1. 장비 체크리스트 및 명판", "production_date": "2025-04-29"}	2026-03-28 15:26:47.086811	2026-03-28 16:26:28.795722	\N	\N	\N
a7c455d9-c78e-499d-9d55-82659a3983f2	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	03_공도구_관리	XLSX	20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#공도구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240718_장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트.xlsx", "official_name": "장비_1._8BC_공도구_및_중장비_반입_일정_240718_100. 공도구 제원 & 반입 계획 및 리스트", "production_date": "2024-07-18"}	2026-03-28 15:26:47.090403	2026-03-28 16:26:28.795722	\N	\N	\N
925e47c2-3016-476c-9c1a-1be4f34c4ce1	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	03_공도구_관리	XLSX	20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#공도구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20240729_장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정.xlsx", "official_name": "장비_1._8BC_공도구_및_중장비_반입_일정_2407229_STK_1. STK , C.V 반입일정", "production_date": "2024-07-29"}	2026-03-28 15:26:47.160554	2026-03-28 16:26:28.795722	\N	\N	\N
1743d9cd-c53e-4b94-ae09-d337c2db1553	e63249c5-365e-499f-aa01-c26778fe19c6	03_장비_공도구	03_공도구_관리	XLSX	20241106_공도구_8BC_공도구_제원_현황_List_240826(차대번호_포함)_SDC_8B.xlsx	APPROVED	NORMAL	v1	{"tags": ["#장비", "#공도구"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\03_장비_공도구\\\\20241106_공도구_8BC_공도구_제원_현황_List_240826(차대번호_포함)_SDC_8B.xlsx", "official_name": "공도구_8BC_공도구_제원_현황_List_240826(차대번호_포함)_SDC_8B", "production_date": "2024-11-06"}	2026-03-28 15:26:47.225287	2026-03-28 16:26:28.795722	\N	\N	\N
5b28964e-34d4-4bd6-95ff-bec9ffab6f67	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	JPG	20230615_사진_고임목_사용기준_SDC_8B.jpg	APPROVED	NORMAL	v1	{"tags": ["#기록", "#사진대지"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20230615_사진_고임목_사용기준_SDC_8B.jpg", "official_name": "사진_고임목_사용기준_SDC_8B", "production_date": "2023-06-15"}	2026-03-28 15:26:47.230694	2026-03-28 16:26:28.795722	\N	\N	\N
06a92ebe-9351-43d8-9954-874f97da5dd5	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	JPG	20240327_사진_관리감독자_수료증_동춘월_(온라인_8hr)_1. 관리감독자 , 관리책임자.jpg	APPROVED	NORMAL	v1	{"tags": ["#기록", "#사진대지"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20240327_사진_관리감독자_수료증_동춘월_(온라인_8hr)_1. 관리감독자 , 관리책임자.jpg", "official_name": "사진_관리감독자_수료증_동춘월_(온라인_8hr)_1. 관리감독자 , 관리책임자", "production_date": "2024-03-27"}	2026-03-28 15:26:47.238055	2026-03-28 16:26:28.795722	\N	\N	\N
082d6062-e19a-4a79-b37f-d6c921da0f3e	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	JPG	20240731_사진_권오형_관리감독자_수료증_(온라인)_1_1. 사진.jpg	APPROVED	NORMAL	v1	{"tags": ["#기록", "#사진대지"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20240731_사진_권오형_관리감독자_수료증_(온라인)_1_1. 사진.jpg", "official_name": "사진_권오형_관리감독자_수료증_(온라인)_1_1. 사진", "production_date": "2024-07-31"}	2026-03-28 15:26:47.244489	2026-03-28 16:26:28.795722	\N	\N	\N
77b97927-98a5-4c31-bbed-8e0d9a02e253	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	JPG	20240731_사진_박태리_관리감독자_수료증_(온라인)_1_1. 사진.jpg	APPROVED	NORMAL	v1	{"tags": ["#기록", "#사진대지"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20240731_사진_박태리_관리감독자_수료증_(온라인)_1_1. 사진.jpg", "official_name": "사진_박태리_관리감독자_수료증_(온라인)_1_1. 사진", "production_date": "2024-07-31"}	2026-03-28 15:26:47.248512	2026-03-28 16:26:28.795722	\N	\N	\N
45d1ba01-3966-4bbd-955f-755fac84e599	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	01_사진대지	JPG	20240731_사진_이건식_관리감독자_수료증_(온라인)_1_1. 사진.jpg	APPROVED	NORMAL	v1	{"tags": ["#기록", "#사진대지"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20240731_사진_이건식_관리감독자_수료증_(온라인)_1_1. 사진.jpg", "official_name": "사진_이건식_관리감독자_수료증_(온라인)_1_1. 사진", "production_date": "2024-07-31"}	2026-03-28 15:26:47.253108	2026-03-28 16:26:28.795722	\N	\N	\N
082073f1-4acc-4a4d-9167-d9f4e8676fcc	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	HWP	20240206_회의록_[서식]_Tool_Box_Meeting_회의록_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp	APPROVED	NORMAL	v1	{"tags": ["#기록", "#회의록"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20240206_회의록_[서식]_Tool_Box_Meeting_회의록_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등).hwp", "official_name": "회의록_[서식]_Tool_Box_Meeting_회의록_[중대안전보건예방협회] 중대재해처벌법, 위험성평가 자료(문서, 서식, 규정 등)", "production_date": "2024-02-06"}	2026-03-28 15:26:47.264081	2026-03-28 16:26:28.795722	\N	\N	\N
6867628d-2add-43ac-8472-544e45758bc2	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	PDF	20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록.pdf	APPROVED	NORMAL	v1	{"tags": ["#기록", "#회의록"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록.pdf", "official_name": "회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록", "production_date": "2025-02-14"}	2026-03-28 15:26:47.285095	2026-03-28 16:26:28.795722	\N	\N	\N
2de46517-b3c0-4a25-9191-c686e12ceeab	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	PDF	20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록_v1.pdf	APPROVED	NORMAL	v1	{"tags": ["#기록", "#회의록"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20250214_회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록_v1.pdf", "official_name": "회의록_SDC_및_협의체_회의록_크로스특수_3W_회의록_v1", "production_date": "2025-02-14"}	2026-03-28 15:26:47.334411	2026-03-28 16:26:28.795722	\N	\N	\N
d46d3a4d-63e5-4d29-aba4-739a511cdea2	e63249c5-365e-499f-aa01-c26778fe19c6	04_기록_자료	03_회의록_일반	PDF	20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록.pdf	APPROVED	NORMAL	v1	{"tags": ["#기록", "#회의록"], "source_path": "C:\\\\ProjectCode\\\\Cross\\\\Data\\\\CrossDoc\\\\StdFolder\\\\04_기록_자료\\\\20250214_회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록.pdf", "official_name": "회의록_SDC_및_협의체_회의록_크로스특수_4W_회의록", "production_date": "2025-02-14"}	2026-03-28 15:26:47.405696	2026-03-28 16:26:28.795722	\N	\N	\N
\.


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipment (id, equipment_id, name, category, model, manufacturer, manufacture_year, specifications, serial_number, acquisition_date, equipment_status, purchase_type, purchase_amount, residual_value, depreciation_method, contract_start_date, contract_end_date, supplier, supplier_contact, warranty_period, registration_number, insurance_info, inspection_cycle, last_inspection_date, next_inspection_date, assigned_site, operator_name, primary_use, operating_hours, usage_restrictions, maintenance_cycle, consumables_cycle, parts_lifespan, service_provider, service_contact, accumulated_hours, fuel_consumption, work_performance, failure_records, downtime_hours, fuel_cost, maintenance_cost, insurance_cost, depreciation_cost, rental_cost, total_cost, documents, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, code, name, status, created_at) FROM stdin;
e63249c5-365e-499f-aa01-c26778fe19c6	PRJ-2401	A공장 설비 해체	ACTIVE	2026-03-28 09:36:34.971622
f72158d6-476f-5a0a-bb12-d37889ef20d7	PRJ-2402	B타워 철거	ACTIVE	2026-03-28 09:36:34.974539
\.


--
-- Data for Name: report_approvals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_approvals (id, report_id, approver_id, step, status, comment, updated_at) FROM stdin;
\.


--
-- Data for Name: report_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.report_templates (id, title, type, layout_config, created_at) FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reports (id, project_id, template_id, title, report_date, status, content, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resources (id, type, name, project_id, created_at) FROM stdin;
\.


--
-- Data for Name: sms_checklist_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_checklist_templates (id, title, items, category, updated_at) FROM stdin;
\.


--
-- Data for Name: sms_checklists; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_checklists (id, project_id, template_id, title, status, results, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: sms_document_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_document_comments (id, document_id, commenter_name, commenter_role, comment, status, created_at) FROM stdin;
\.


--
-- Data for Name: sms_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_documents (id, project_id, category, title, description, file_url, file_name, file_size, uploaded_by, upload_date, created_at) FROM stdin;
\.


--
-- Data for Name: sms_dris; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_dris (id, project_id, date, location, work_content, risk_points, attendees_count, photo_url, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: sms_education_attendees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_education_attendees (id, education_id, worker_name, worker_birth, worker_agency, signature_url, attended_at) FROM stdin;
\.


--
-- Data for Name: sms_educations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_educations (id, project_id, title, type, instructor, date, place, content, photo_url, status, created_at) FROM stdin;
\.


--
-- Data for Name: sms_incident_photos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_incident_photos (id, incident_id, photo_url, created_at) FROM stdin;
\.


--
-- Data for Name: sms_incidents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_incidents (id, project_id, type, title, date, "time", place, description, cause, measure, reporter, status, created_at) FROM stdin;
\.


--
-- Data for Name: sms_patrols; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_patrols (id, project_id, location, issue_type, severity, description, action_required, photo_url, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: sms_personnel; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_personnel (id, project_id, name, birth_date, job_type, blood_type, phone, agency, qr_code_data, photo_url, status, created_at) FROM stdin;
\.


--
-- Data for Name: sms_risk_assessments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_risk_assessments (id, project_id, process_name, assessor_name, approver_name, status, date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sms_risk_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sms_risk_items (id, assessment_id, risk_factor, risk_type, frequency, severity, mitigation_measure, action_manager, action_deadline, created_at) FROM stdin;
\.


--
-- Data for Name: swms_generations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_generations (id, site_id, project_id, generation_date, material_type_id, process_name, quantity, unit, location, notes, status, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: swms_inbounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_inbounds (id, site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, grade, quantity, unit_price, total_amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: swms_inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_inventory (id, site_id, warehouse_id, material_type_id, grade, quantity, last_updated_at) FROM stdin;
\.


--
-- Data for Name: swms_inventory_adjustments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_inventory_adjustments (id, site_id, warehouse_id, material_type_id, quantity, reason, adjustment_type, adjustment_date, created_at) FROM stdin;
\.


--
-- Data for Name: swms_material_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_material_types (id, code, name, category, unit, unit_price, symbol) FROM stdin;
aae69a4c-a546-4755-aa4c-e8553a5b4124	\N	스크랩-구리 A	스크랩	톤	8500000.00	CU
a1b9a7a3-d4a2-44b3-84a2-d38c5e73c789	\N	스크랩-알루미늄	스크랩	톤	1800000.00	AL
c3111914-f5c3-4b2c-9dc6-d0495ce07f9b	\N	스크랩-아연	스크랩	톤	3200000.00	ZN
517dbe63-78e2-4676-ac0b-6716eb468a03	\N	스크랩-주석	스크랩	톤	28000000.00	SN
2a65ce6d-9bff-46c1-9ffb-e2d510962aa4	\N	철근스크랩	스크랩	톤	350000.00	\N
f1e62fbc-010a-4169-9144-8ea15cb8ab20	\N	혼합폐기물	폐기물	톤	-150000.00	\N
\.


--
-- Data for Name: swms_outbounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_outbounds (id, site_id, project_id, outbound_date, warehouse_id, vendor_id, material_type_id, grade, quantity, unit_price, total_amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: swms_settlement_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_settlement_items (id, settlement_id, outbound_id) FROM stdin;
\.


--
-- Data for Name: swms_settlements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_settlements (id, site_id, vendor_id, start_date, end_date, total_supply_price, total_vat, total_amount, status, tax_invoice_no, created_at) FROM stdin;
\.


--
-- Data for Name: swms_vendors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_vendors (id, name, type, contact, registration_no) FROM stdin;
67a71b7b-921e-424a-b2ad-59bf554b9572	동부제철	매입처	\N	\N
6af71c12-8b06-480f-967a-641e8c391bd8	현대제철	매입처	\N	\N
7de5b1a9-20c2-42ea-b7d1-0dcb8c4173bb	파주환경	처리업체	\N	\N
a026542a-95e2-494c-8aae-a7378a706a76	대성자원	운반업체	\N	\N
\.


--
-- Data for Name: swms_warehouses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_warehouses (id, site_id, name, type, capacity, unit, created_at) FROM stdin;
\.


--
-- Data for Name: swms_weighings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.swms_weighings (id, site_id, project_id, weighing_date, weighing_time, vehicle_number, driver_name, driver_contact, material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (uid, email, name, role, status, contact, code, branch, created_at) FROM stdin;
\.


--
-- Name: sms_patrols_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sms_patrols_id_seq', 1, false);


--
-- Name: contract_items contract_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_items
    ADD CONSTRAINT contract_items_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_code_key UNIQUE (code);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: dms_categories dms_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dms_categories
    ADD CONSTRAINT dms_categories_pkey PRIMARY KEY (id);


--
-- Name: document_versions document_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: projects projects_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_code_key UNIQUE (code);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: report_approvals report_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_approvals
    ADD CONSTRAINT report_approvals_pkey PRIMARY KEY (id);


--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: sms_checklist_templates sms_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_checklist_templates
    ADD CONSTRAINT sms_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: sms_checklists sms_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_checklists
    ADD CONSTRAINT sms_checklists_pkey PRIMARY KEY (id);


--
-- Name: sms_document_comments sms_document_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_document_comments
    ADD CONSTRAINT sms_document_comments_pkey PRIMARY KEY (id);


--
-- Name: sms_documents sms_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_documents
    ADD CONSTRAINT sms_documents_pkey PRIMARY KEY (id);


--
-- Name: sms_dris sms_dris_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_dris
    ADD CONSTRAINT sms_dris_pkey PRIMARY KEY (id);


--
-- Name: sms_education_attendees sms_education_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_education_attendees
    ADD CONSTRAINT sms_education_attendees_pkey PRIMARY KEY (id);


--
-- Name: sms_educations sms_educations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_educations
    ADD CONSTRAINT sms_educations_pkey PRIMARY KEY (id);


--
-- Name: sms_incident_photos sms_incident_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_incident_photos
    ADD CONSTRAINT sms_incident_photos_pkey PRIMARY KEY (id);


--
-- Name: sms_incidents sms_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_incidents
    ADD CONSTRAINT sms_incidents_pkey PRIMARY KEY (id);


--
-- Name: sms_patrols sms_patrols_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_patrols
    ADD CONSTRAINT sms_patrols_pkey PRIMARY KEY (id);


--
-- Name: sms_personnel sms_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_personnel
    ADD CONSTRAINT sms_personnel_pkey PRIMARY KEY (id);


--
-- Name: sms_risk_assessments sms_risk_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_risk_assessments
    ADD CONSTRAINT sms_risk_assessments_pkey PRIMARY KEY (id);


--
-- Name: sms_risk_items sms_risk_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_risk_items
    ADD CONSTRAINT sms_risk_items_pkey PRIMARY KEY (id);


--
-- Name: swms_generations swms_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_generations
    ADD CONSTRAINT swms_generations_pkey PRIMARY KEY (id);


--
-- Name: swms_inbounds swms_inbounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inbounds
    ADD CONSTRAINT swms_inbounds_pkey PRIMARY KEY (id);


--
-- Name: swms_inventory_adjustments swms_inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inventory_adjustments
    ADD CONSTRAINT swms_inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: swms_inventory swms_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inventory
    ADD CONSTRAINT swms_inventory_pkey PRIMARY KEY (id);


--
-- Name: swms_inventory swms_inventory_site_id_warehouse_id_material_type_id_grade_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inventory
    ADD CONSTRAINT swms_inventory_site_id_warehouse_id_material_type_id_grade_key UNIQUE (site_id, warehouse_id, material_type_id, grade);


--
-- Name: swms_material_types swms_material_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_material_types
    ADD CONSTRAINT swms_material_types_pkey PRIMARY KEY (id);


--
-- Name: swms_outbounds swms_outbounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_outbounds
    ADD CONSTRAINT swms_outbounds_pkey PRIMARY KEY (id);


--
-- Name: swms_settlement_items swms_settlement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_settlement_items
    ADD CONSTRAINT swms_settlement_items_pkey PRIMARY KEY (id);


--
-- Name: swms_settlements swms_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_settlements
    ADD CONSTRAINT swms_settlements_pkey PRIMARY KEY (id);


--
-- Name: swms_vendors swms_vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_vendors
    ADD CONSTRAINT swms_vendors_pkey PRIMARY KEY (id);


--
-- Name: swms_warehouses swms_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_warehouses
    ADD CONSTRAINT swms_warehouses_pkey PRIMARY KEY (id);


--
-- Name: swms_weighings swms_weighings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_weighings
    ADD CONSTRAINT swms_weighings_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (uid);


--
-- Name: idx_dms_categories_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dms_categories_project ON public.dms_categories USING btree (project_id);


--
-- Name: idx_docs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_category ON public.documents USING btree (category);


--
-- Name: idx_docs_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_project ON public.documents USING btree (project_id);


--
-- Name: idx_docs_sub_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_sub_category ON public.documents USING btree (sub_category);


--
-- Name: documents update_documents_modtime; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_documents_modtime BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();


--
-- Name: contract_items contract_items_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_items
    ADD CONSTRAINT contract_items_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: dms_categories dms_categories_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dms_categories
    ADD CONSTRAINT dms_categories_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: document_versions document_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_versions
    ADD CONSTRAINT document_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: report_approvals report_approvals_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_approvals
    ADD CONSTRAINT report_approvals_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: reports reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id);


--
-- Name: sms_document_comments sms_document_comments_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_document_comments
    ADD CONSTRAINT sms_document_comments_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.sms_documents(id) ON DELETE CASCADE;


--
-- Name: sms_education_attendees sms_education_attendees_education_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_education_attendees
    ADD CONSTRAINT sms_education_attendees_education_id_fkey FOREIGN KEY (education_id) REFERENCES public.sms_educations(id) ON DELETE CASCADE;


--
-- Name: sms_incident_photos sms_incident_photos_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_incident_photos
    ADD CONSTRAINT sms_incident_photos_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.sms_incidents(id) ON DELETE CASCADE;


--
-- Name: sms_patrols sms_patrols_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_patrols
    ADD CONSTRAINT sms_patrols_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: sms_risk_items sms_risk_items_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_risk_items
    ADD CONSTRAINT sms_risk_items_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.sms_risk_assessments(id) ON DELETE CASCADE;


--
-- Name: swms_generations swms_generations_material_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_generations
    ADD CONSTRAINT swms_generations_material_type_id_fkey FOREIGN KEY (material_type_id) REFERENCES public.swms_material_types(id);


--
-- Name: swms_inbounds swms_inbounds_material_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inbounds
    ADD CONSTRAINT swms_inbounds_material_type_id_fkey FOREIGN KEY (material_type_id) REFERENCES public.swms_material_types(id);


--
-- Name: swms_inbounds swms_inbounds_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inbounds
    ADD CONSTRAINT swms_inbounds_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.swms_vendors(id);


--
-- Name: swms_inventory swms_inventory_material_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_inventory
    ADD CONSTRAINT swms_inventory_material_type_id_fkey FOREIGN KEY (material_type_id) REFERENCES public.swms_material_types(id);


--
-- Name: swms_outbounds swms_outbounds_material_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_outbounds
    ADD CONSTRAINT swms_outbounds_material_type_id_fkey FOREIGN KEY (material_type_id) REFERENCES public.swms_material_types(id);


--
-- Name: swms_outbounds swms_outbounds_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_outbounds
    ADD CONSTRAINT swms_outbounds_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.swms_vendors(id);


--
-- Name: swms_settlement_items swms_settlement_items_outbound_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_settlement_items
    ADD CONSTRAINT swms_settlement_items_outbound_id_fkey FOREIGN KEY (outbound_id) REFERENCES public.swms_outbounds(id);


--
-- Name: swms_settlement_items swms_settlement_items_settlement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_settlement_items
    ADD CONSTRAINT swms_settlement_items_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES public.swms_settlements(id) ON DELETE CASCADE;


--
-- Name: swms_settlements swms_settlements_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_settlements
    ADD CONSTRAINT swms_settlements_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.swms_vendors(id);


--
-- Name: swms_weighings swms_weighings_material_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_weighings
    ADD CONSTRAINT swms_weighings_material_type_id_fkey FOREIGN KEY (material_type_id) REFERENCES public.swms_material_types(id);


--
-- Name: swms_weighings swms_weighings_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swms_weighings
    ADD CONSTRAINT swms_weighings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.swms_vendors(id);


--
-- PostgreSQL database dump complete
--

\unrestrict deL9fRiInDqNP20fXp9AViRAhGl1dcVgUMtlllaKRd64ednuYtYca71O3N7Z4Zs

