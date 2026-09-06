# Home timeline review events fix

The Home timeline must use review_events as the source of historical vocabulary practice. The current investigation found the read model filters review_events by mode values and this can hide existing historical review records.

The fix will make the timeline projection include canonical review_events history and add regression coverage for old practice dates loaded by scrolling history.
