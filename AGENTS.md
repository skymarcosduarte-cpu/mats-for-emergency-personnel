# Architecture rules

- Monitoring Center derives its fixed stream assignments from the catalog on every mount and keeps audio state in memory, ignoring legacy saved camera selections so removed sources cannot reappear.
- Monitoring audio uses YouTube iframe commands rather than changing the iframe URL, so muting does not reload the stream.