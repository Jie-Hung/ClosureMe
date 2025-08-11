--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users (id, username, password, email) VALUES (1, 'aaa', '$2b$10$/nQd7pgZ2jVAmbvLN56J4elAm9ZNwNjqPC/bVi9Ox1raqVuto.ANi', 'aaa@gmail.com');
INSERT INTO public.users (id, username, password, email) VALUES (2, 'bbb', '$2b$10$afEX/CruSMrkdxlw/WDFmeKnqhpQM4ES1PtmwCXTmocXygMoWUe6W', 'bbb@gmail.com');
INSERT INTO public.users (id, username, password, email) VALUES (15, 'ccc', '$2b$10$83DyFTQoHilUMg81d.CjGOWtW/vnwZjAg2ZV2jKp0wBJetaWSrghq', 'ccc@gmail.com');
INSERT INTO public.users (id, username, password, email) VALUES (16, 'nigga123', '$2b$10$XjA/HFyox55AcFPOKi/tSeQ8qKAwbUemd0CP0CC8nt4oCrALvkEZW', 'nigga@gmail.com');


--
-- Data for Name: char_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.char_images (id, user_id, file_name, file_path, uploaded_at) VALUES (123, 1, 'Freya.png', '/uploads/Freya.png', '2025-08-08 17:34:37.210636');


--
-- Data for Name: char_memory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.char_memory (id, image_id, created_at, file_path) VALUES (82, 123, '2025-08-08 17:34:37.216067', '/uploads/Freya_memory.json');


--
-- Data for Name: char_profile; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.char_profile (id, image_id, created_at, file_path) VALUES (82, 123, '2025-08-08 17:34:37.215004', '/uploads/Freya_profile.json');


--
-- Data for Name: char_voice; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.char_voice (id, image_id, created_at, file_path) VALUES (2, 123, '2025-08-08 17:34:37.217756', '/uploads/Freya_voice.wav');


--
-- Name: char_appearance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.char_appearance_id_seq', 82, true);


--
-- Name: char_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.char_images_id_seq', 123, true);


--
-- Name: char_memory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.char_memory_id_seq', 82, true);


--
-- Name: char_voice_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.char_voice_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 17, true);


--
-- PostgreSQL database dump complete
--

