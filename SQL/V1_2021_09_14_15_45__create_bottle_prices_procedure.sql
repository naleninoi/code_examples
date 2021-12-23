-- new migrations goes here
DROP PROCEDURE IF EXISTS create_bottle_prices;

DELIMITER //
create procedure create_bottle_prices()
begin
    DECLARE offs_qty INT;
    DECLARE b_types_qty INT;
    DECLARE i INT DEFAULT 1;
    DECLARE j INT DEFAULT 1;

    DECLARE off_id INT;
    DECLARE b_type_id INT;

    DROP TABLE IF EXISTS office_ids;
    DROP TABLE IF EXISTS bottle_type_ids;

    CREATE TEMPORARY TABLE office_ids (id INT NOT NULL AUTO_INCREMENT, office_id BIGINT NOT NULL, PRIMARY KEY(id) );
    CREATE TEMPORARY TABLE bottle_type_ids (id INT NOT NULL AUTO_INCREMENT, bottle_type_id BIGINT NOT NULL, PRIMARY KEY(id) );

    SET offs_qty = (SELECT COUNT(*) FROM offices o WHERE o.is_deleted = 0);
    SET b_types_qty = (SELECT COUNT(*) FROM bottle_types b WHERE b.is_deleted = 0);

    INSERT INTO office_ids (office_id) SELECT id FROM offices o WHERE o.is_deleted = 0;
    INSERT INTO bottle_type_ids (bottle_type_id) SELECT id FROM bottle_types b WHERE b.is_deleted = 0;


    offices_loop: REPEAT

        SET off_id = (SELECT office_id FROM office_ids oi WHERE oi.id = i);

        btypes_loop: REPEAT

            SET b_type_id = (SELECT bottle_type_id FROM bottle_type_ids bi WHERE bi.id = j);

            INSERT INTO bottle_prices(office_id, bottle_type_id, price) VALUES (off_id, b_type_id, 0);

            SET j = j + 1;

        UNTIL j > b_types_qty END REPEAT;

        SET i = i + 1;
        SET j = 1;

    UNTIL i > offs_qty END REPEAT;

    DROP TABLE office_ids;
    DROP TABLE bottle_type_ids;

END//

DELIMITER ;
