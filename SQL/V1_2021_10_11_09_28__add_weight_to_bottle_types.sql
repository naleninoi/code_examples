-- new migrations goes here
ALTER TABLE bottle_types ADD COLUMN weight INT DEFAULT 0 AFTER title;