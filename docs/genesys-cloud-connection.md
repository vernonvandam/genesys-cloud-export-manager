# Connecting to Genesys Cloud

Integrated sign-in uses Genesys Cloud OAuth. When configured and launched
through Genesys Cloud, the app verifies the signed-in user and organization.

## Before connecting

- Register the app's HTTPS redirect URI on a public Genesys OAuth client.
- Configure the client with the `users:readonly` and
  `organizations:readonly` permissions.
- Launch the app with the OAuth client ID, region, and redirect URI.

## Check connection status

The workspace sidebar and page header show whether the Genesys connection is
active. Open Settings to review connection details if authentication fails or
the app is not connected.

Standalone email sign-in is a separate account flow and does not itself connect
the app to Genesys Cloud.
