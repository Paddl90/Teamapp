project_id = "__PROJECT_ID__"

[api]
enabled = true
port = __API_PORT__
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = __DB_PORT__
shadow_port = __SHADOW_PORT__
major_version = 17

[db.migrations]
enabled = true
schema_paths = []

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]

[realtime]
enabled = true

[studio]
enabled = true
port = __STUDIO_PORT__
api_url = "http://__BIND_IP__:__API_PORT__"

[local_smtp]
enabled = true
port = __MAIL_PORT__

[storage]
enabled = true
file_size_limit = "50MiB"

[storage.analytics]
enabled = false

[storage.vector]
enabled = false

[auth]
enabled = true
site_url = "http://__BIND_IP__:__WEB_PORT__"
additional_redirect_urls = ["http://127.0.0.1:__WEB_PORT__", "http://localhost:__WEB_PORT__", "http://__BIND_IP__:__WEB_PORT__"]
enable_signup = true
minimum_password_length = 8

[auth.email]
enable_signup = true
enable_confirmations = false

[edge_runtime]
enabled = false
inspector_port = __INSPECTOR_PORT__

[analytics]
enabled = false
port = __ANALYTICS_PORT__
