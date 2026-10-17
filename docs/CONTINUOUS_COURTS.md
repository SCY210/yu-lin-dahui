# Continuous court reservations

Consecutive reservations for the same named court at the same venue form one signup card, even when different members booked or advanced each part. A gap, another court name, or another venue starts a separate card. Two courts with six places each remain twelve places when both reservations are split into two parts; they do not become twenty-four places.

The creation limit is per physical court. Capacity and occupied places describe concurrent places, while the roster contains each participant once. Members may still select a shorter attendance interval. Each original reservation retains its ID, payer, price, and time range for fee allocation and scheduling. The card exposes each part's booking settings to its manager.

Grouped registration, cancellation, and queue changes use the server-derived court group, validate every underlying reservation, and commit the domain changes together. Existing single-reservation API requests remain supported. Signup deadlines, cancellation approval, participant authority, current-game restrictions, and historical fee records retain their checks. A later-segment failure cannot leave a partial signup.

This is a derived grouping for existing activities too; it requires no production-data rewrite or schema migration.
