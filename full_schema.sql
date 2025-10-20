--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
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
-- Name: closureme_db; Type: DATABASE; Schema: -; Owner: closureme_db_user
--

CREATE DATABASE closureme_db WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF8';


ALTER DATABASE closureme_db OWNER TO closureme_db_user;

\connect closureme_db

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
-- Name: closureme_db; Type: DATABASE PROPERTIES; Schema: -; Owner: closureme_db_user
--

ALTER DATABASE closureme_db SET "TimeZone" TO 'utc';


\connect closureme_db

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: closureme_db_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO closureme_db_user;

--
-- Name: enforce_same_batch(); Type: FUNCTION; Schema: public; Owner: closureme_db_user
--

CREATE FUNCTION public.enforce_same_batch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  batch_main uuid;
  batch_parts uuid;
BEGIN
  -- 若這筆是 head/body：改成與 main 同 batch
  IF NEW.role_type IN ('head','body') THEN
    SELECT upload_batch INTO batch_main
    FROM char_images
    WHERE user_id = NEW.user_id
      AND role_type = 'main'
      AND split_part(file_name,'.',1) = split_part(NEW.file_name,'_',1)
    LIMIT 1;

    IF batch_main IS NOT NULL THEN
      NEW.upload_batch := batch_main;
    END IF;

  -- 若這筆是 main：若已有 head/body，沿用它們的 batch
  ELSIF NEW.role_type = 'main' THEN
    SELECT upload_batch INTO batch_parts
    FROM char_images
    WHERE user_id = NEW.user_id
      AND role_type IN ('head','body')
      AND split_part(file_name,'_',1) = split_part(NEW.file_name,'.',1)
    ORDER BY uploaded_at DESC
    LIMIT 1;

    IF batch_parts IS NOT NULL THEN
      NEW.upload_batch := batch_parts;
    END IF;
  END IF;

  RETURN NEW;
END; $$;


ALTER FUNCTION public.enforce_same_batch() OWNER TO closureme_db_user;

--
-- Name: char_appearance_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

CREATE SEQUENCE public.char_appearance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.char_appearance_id_seq OWNER TO closureme_db_user;

--
-- Name: char_images_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

CREATE SEQUENCE public.char_images_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.char_images_id_seq OWNER TO closureme_db_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: char_images; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.char_images (
    id integer DEFAULT nextval('public.char_images_id_seq'::regclass) NOT NULL,
    user_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    uploaded_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Taipei'::text),
    upload_batch text,
    role_type text DEFAULT 'main'::text
);


ALTER TABLE public.char_images OWNER TO closureme_db_user;

--
-- Name: char_memory_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

CREATE SEQUENCE public.char_memory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.char_memory_id_seq OWNER TO closureme_db_user;

--
-- Name: char_memory; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.char_memory (
    id integer DEFAULT nextval('public.char_memory_id_seq'::regclass) NOT NULL,
    image_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Taipei'::text),
    file_path character varying(500)
);


ALTER TABLE public.char_memory OWNER TO closureme_db_user;

--
-- Name: char_model; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.char_model (
    id integer NOT NULL,
    image_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Taipei'::text),
    file_path character varying(500) NOT NULL
);


ALTER TABLE public.char_model OWNER TO closureme_db_user;

--
-- Name: char_model_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

CREATE SEQUENCE public.char_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.char_model_id_seq OWNER TO closureme_db_user;

--
-- Name: char_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: closureme_db_user
--

ALTER SEQUENCE public.char_model_id_seq OWNED BY public.char_model.id;


--
-- Name: char_profile; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.char_profile (
    id integer DEFAULT nextval('public.char_appearance_id_seq'::regclass) NOT NULL,
    image_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Taipei'::text),
    file_path character varying(500)
);


ALTER TABLE public.char_profile OWNER TO closureme_db_user;

--
-- Name: char_voice; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.char_voice (
    id integer NOT NULL,
    image_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Taipei'::text),
    file_path text
);


ALTER TABLE public.char_voice OWNER TO closureme_db_user;

--
-- Name: char_voice_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

ALTER TABLE public.char_voice ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.char_voice_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: closureme_db_user
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO closureme_db_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: closureme_db_user
--

CREATE TABLE public.users (
    id integer DEFAULT nextval('public.users_id_seq'::regclass) NOT NULL,
    username character varying(255) NOT NULL,
    password text NOT NULL,
    email text
);


ALTER TABLE public.users OWNER TO closureme_db_user;

--
-- Name: char_model id; Type: DEFAULT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_model ALTER COLUMN id SET DEFAULT nextval('public.char_model_id_seq'::regclass);


--
-- Name: char_images char_images_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_images
    ADD CONSTRAINT char_images_pkey PRIMARY KEY (id);


--
-- Name: char_memory char_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_memory
    ADD CONSTRAINT char_memory_pkey PRIMARY KEY (id);


--
-- Name: char_model char_model_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_model
    ADD CONSTRAINT char_model_pkey PRIMARY KEY (id);


--
-- Name: char_profile char_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_profile
    ADD CONSTRAINT char_profile_pkey PRIMARY KEY (id);


--
-- Name: char_voice char_voice_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_voice
    ADD CONSTRAINT char_voice_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: idx_char_images_upload_batch; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_images_upload_batch ON public.char_images USING btree (upload_batch);


--
-- Name: idx_char_images_user_role; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_images_user_role ON public.char_images USING btree (user_id, role_type);


--
-- Name: idx_char_memory_image_id; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_memory_image_id ON public.char_memory USING btree (image_id);


--
-- Name: idx_char_model_image_id; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_model_image_id ON public.char_model USING btree (image_id);


--
-- Name: idx_char_profile_image_id; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_profile_image_id ON public.char_profile USING btree (image_id);


--
-- Name: idx_char_voice_image_id; Type: INDEX; Schema: public; Owner: closureme_db_user
--

CREATE INDEX idx_char_voice_image_id ON public.char_voice USING btree (image_id);


--
-- Name: char_images trg_enforce_same_batch; Type: TRIGGER; Schema: public; Owner: closureme_db_user
--

CREATE TRIGGER trg_enforce_same_batch BEFORE INSERT OR UPDATE ON public.char_images FOR EACH ROW EXECUTE FUNCTION public.enforce_same_batch();


--
-- Name: char_images char_images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_images
    ADD CONSTRAINT char_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: char_memory char_memory_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_memory
    ADD CONSTRAINT char_memory_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.char_images(id) ON DELETE CASCADE;


--
-- Name: char_model char_model_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_model
    ADD CONSTRAINT char_model_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.char_images(id) ON DELETE CASCADE;


--
-- Name: char_profile char_profile_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_profile
    ADD CONSTRAINT char_profile_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.char_images(id) ON DELETE CASCADE;


--
-- Name: char_voice char_voice_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: closureme_db_user
--

ALTER TABLE ONLY public.char_voice
    ADD CONSTRAINT char_voice_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.char_images(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO closureme_db_user;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO closureme_db_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO closureme_db_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO closureme_db_user;


--
-- PostgreSQL database dump complete
--

