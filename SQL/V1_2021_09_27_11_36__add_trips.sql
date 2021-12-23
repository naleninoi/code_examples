-- new migrations goes here
CREATE TABLE trips (
                        id bigint auto_increment,
                        office_id bigint not null,
                        manager_user_id bigint not null,
                        worker_id bigint,
                        auto_id bigint not null,
                        status varchar(100),
                        due_date datetime,
                        created timestamp not null default current_timestamp,
                        updated timestamp null on update current_timestamp,
                        primary key (id)
);

CREATE TABLE trips_orders (
                       trip_id bigint not null,
                       order_id bigint not null,
                       primary key (trip_id, order_id)
);