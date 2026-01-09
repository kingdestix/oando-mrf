# Run Database Migration

To fix the "material_sent_to_requestor column does not exist" error, run this SQL migration:

## Option 1: Using pgAdmin
1. Open pgAdmin
2. Connect to your database (mrf_db)
3. Open Query Tool
4. Copy and paste the contents of `backend/models/add-material-sent-to-requestor-columns.sql`
5. Execute the query

## Option 2: Using psql command line
```bash
psql -U postgres -d mrf_db -f backend/models/add-material-sent-to-requestor-columns.sql
```

## Option 3: Using Node.js script
You can also run it programmatically by creating a simple script, or just execute the SQL directly in your database client.

The migration adds:
- `material_sent_to_requestor` (BOOLEAN) - tracks if DU has sent materials to requestor
- `material_sent_to_requestor_date` (TIMESTAMP) - timestamp when materials were sent

