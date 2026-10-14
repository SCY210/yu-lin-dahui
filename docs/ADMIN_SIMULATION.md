# Retired administrator simulation

The administrator scheduling simulation has been removed from the activity list,
client navigation and production bundles. Old `?page=simulation` links and history
entries resolve to the activity list without carrying event or player identifiers.

The retired `/api/simulation` endpoint returns HTTP 410 for reads and writes. It
does not load authentication, club state or D1, and cannot initialize, reset or
update a simulation. The old three-second simulation poller is no longer shipped.
Existing isolated settings snapshots are left untouched and are not read or
exposed by the retired endpoint. Real activities and results are unchanged.

Scheduler, automatic-start and conditional-read regressions use the fictional
graph in `tests/helpers/scheduling-fixture.ts`. Production modules never import
that helper; these tests continue to run locally against synthetic data.
