PRAGMA journal_mode = DELETE;
PRAGMA synchronous = FULL;

CREATE TABLE IF NOT EXISTS person (
  person_id INTEGER PRIMARY KEY,
  gender_concept_id INTEGER,
  year_of_birth INTEGER,
  month_of_birth INTEGER,
  day_of_birth INTEGER,
  birth_datetime TEXT,
  race_concept_id INTEGER,
  ethnicity_concept_id INTEGER,
  location_id INTEGER,
  provider_id INTEGER,
  care_site_id INTEGER,
  person_source_value TEXT,
  gender_source_value TEXT,
  gender_source_concept_id INTEGER,
  race_source_value TEXT,
  race_source_concept_id INTEGER,
  ethnicity_source_value TEXT,
  ethnicity_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS observation_period (
  observation_period_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  observation_period_start_date TEXT,
  observation_period_end_date TEXT,
  period_type_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS visit_occurrence (
  visit_occurrence_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  visit_concept_id INTEGER,
  visit_start_date TEXT,
  visit_start_datetime TEXT,
  visit_end_date TEXT,
  visit_end_datetime TEXT,
  visit_type_concept_id INTEGER,
  provider_id INTEGER,
  care_site_id INTEGER,
  visit_source_value TEXT,
  visit_source_concept_id INTEGER,
  admitted_from_concept_id INTEGER,
  admitted_from_source_value TEXT,
  discharged_to_concept_id INTEGER,
  discharged_to_source_value TEXT,
  preceding_visit_occurrence_id INTEGER
);

CREATE TABLE IF NOT EXISTS condition_occurrence (
  condition_occurrence_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  condition_concept_id INTEGER,
  condition_start_date TEXT,
  condition_start_datetime TEXT,
  condition_end_date TEXT,
  condition_end_datetime TEXT,
  condition_type_concept_id INTEGER,
  condition_status_concept_id INTEGER,
  stop_reason TEXT,
  provider_id INTEGER,
  visit_occurrence_id INTEGER,
  visit_detail_id INTEGER,
  condition_source_value TEXT,
  condition_source_concept_id INTEGER,
  condition_status_source_value TEXT
);

CREATE TABLE IF NOT EXISTS drug_exposure (
  drug_exposure_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  drug_concept_id INTEGER,
  drug_exposure_start_date TEXT,
  drug_exposure_start_datetime TEXT,
  drug_exposure_end_date TEXT,
  drug_exposure_end_datetime TEXT,
  verbatim_end_date TEXT,
  drug_type_concept_id INTEGER,
  stop_reason TEXT,
  refills INTEGER,
  quantity REAL,
  days_supply INTEGER,
  sig TEXT,
  route_concept_id INTEGER,
  lot_number TEXT,
  provider_id INTEGER,
  visit_occurrence_id INTEGER,
  visit_detail_id INTEGER,
  drug_source_value TEXT,
  drug_source_concept_id INTEGER,
  route_source_value TEXT,
  dose_unit_source_value TEXT
);

CREATE TABLE IF NOT EXISTS procedure_occurrence (
  procedure_occurrence_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  procedure_concept_id INTEGER,
  procedure_date TEXT,
  procedure_datetime TEXT,
  procedure_type_concept_id INTEGER,
  modifier_concept_id INTEGER,
  quantity INTEGER,
  provider_id INTEGER,
  visit_occurrence_id INTEGER,
  visit_detail_id INTEGER,
  procedure_source_value TEXT,
  procedure_source_concept_id INTEGER,
  modifier_source_value TEXT
);

CREATE TABLE IF NOT EXISTS measurement (
  measurement_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  measurement_concept_id INTEGER,
  measurement_date TEXT,
  measurement_datetime TEXT,
  measurement_time TEXT,
  measurement_type_concept_id INTEGER,
  operator_concept_id INTEGER,
  value_as_number REAL,
  value_as_concept_id INTEGER,
  unit_concept_id INTEGER,
  range_low REAL,
  range_high REAL,
  provider_id INTEGER,
  visit_occurrence_id INTEGER,
  visit_detail_id INTEGER,
  measurement_source_value TEXT,
  measurement_source_concept_id INTEGER,
  unit_source_value TEXT,
  value_source_value TEXT
);

CREATE TABLE IF NOT EXISTS observation (
  observation_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  observation_concept_id INTEGER,
  observation_date TEXT,
  observation_datetime TEXT,
  observation_type_concept_id INTEGER,
  value_as_number REAL,
  value_as_string TEXT,
  value_as_concept_id INTEGER,
  qualifier_concept_id INTEGER,
  unit_concept_id INTEGER,
  provider_id INTEGER,
  visit_occurrence_id INTEGER,
  visit_detail_id INTEGER,
  observation_source_value TEXT,
  observation_source_concept_id INTEGER,
  unit_source_value TEXT,
  qualifier_source_value TEXT,
  value_source_value TEXT,
  observation_event_id INTEGER,
  obs_event_field_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS death (
  person_id INTEGER PRIMARY KEY,
  death_date TEXT,
  death_datetime TEXT,
  death_type_concept_id INTEGER,
  cause_concept_id INTEGER,
  cause_source_value TEXT,
  cause_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS payer_plan_period (
  payer_plan_period_id INTEGER PRIMARY KEY,
  person_id INTEGER,
  payer_plan_period_start_date TEXT,
  payer_plan_period_end_date TEXT,
  payer_concept_id INTEGER,
  payer_source_value TEXT,
  payer_source_concept_id INTEGER,
  plan_concept_id INTEGER,
  plan_source_value TEXT,
  plan_source_concept_id INTEGER,
  sponsor_concept_id INTEGER,
  sponsor_source_value TEXT,
  sponsor_source_concept_id INTEGER,
  family_source_value TEXT,
  stop_reason_concept_id INTEGER,
  stop_reason_source_value TEXT,
  stop_reason_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS cdm_source (
  cdm_source_name TEXT,
  cdm_source_abbreviation TEXT,
  cdm_holder TEXT,
  source_description TEXT,
  source_documentation_reference TEXT,
  cdm_etl_reference TEXT,
  source_release_date TEXT,
  cdm_release_date TEXT,
  cdm_version TEXT,
  cdm_version_concept_id INTEGER,
  vocabulary_version TEXT
);

CREATE INDEX IF NOT EXISTS idx_observation_period_person_id ON observation_period (person_id);
CREATE INDEX IF NOT EXISTS idx_visit_occurrence_person_id ON visit_occurrence (person_id);
CREATE INDEX IF NOT EXISTS idx_condition_occurrence_person_id ON condition_occurrence (person_id);
CREATE INDEX IF NOT EXISTS idx_drug_exposure_person_id ON drug_exposure (person_id);
CREATE INDEX IF NOT EXISTS idx_procedure_occurrence_person_id ON procedure_occurrence (person_id);
CREATE INDEX IF NOT EXISTS idx_measurement_person_id ON measurement (person_id);
CREATE INDEX IF NOT EXISTS idx_observation_person_id ON observation (person_id);
CREATE INDEX IF NOT EXISTS idx_payer_plan_period_person_id ON payer_plan_period (person_id);
