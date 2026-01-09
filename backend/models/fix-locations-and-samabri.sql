-- fix-locations-and-samabri.sql
-- Fix location duplicates and change SAMABIRI to SAMABRI

-- 1. Change SAMABIRI to SAMABRI
UPDATE material_requests 
SET asset = 'SAMABRI', workflow_location = 'SAMABRI'
WHERE UPPER(TRIM(asset)) = 'SAMABIRI' OR UPPER(TRIM(workflow_location)) = 'SAMABIRI';

-- 2. Merge IDU F/S variations with IDU
UPDATE material_requests 
SET asset = 'IDU', workflow_location = 'IDU'
WHERE UPPER(TRIM(asset)) IN ('IDU F/S', 'IDU FS', 'IDU F S', 'IDU F.S')
   OR UPPER(TRIM(workflow_location)) IN ('IDU F/S', 'IDU FS', 'IDU F S', 'IDU F.S');

-- 3. Merge IRRI F/S variations with IRRI
UPDATE material_requests 
SET asset = 'IRRI', workflow_location = 'IRRI'
WHERE UPPER(TRIM(asset)) IN ('IRRI F/S', 'IRRI FS', 'IRRI F S', 'IRRI F.S')
   OR UPPER(TRIM(workflow_location)) IN ('IRRI F/S', 'IRRI FS', 'IRRI F S', 'IRRI F.S');

-- 4. Merge OSHIE F/S variations with OSHIE
UPDATE material_requests 
SET asset = 'OSHIE', workflow_location = 'OSHIE'
WHERE UPPER(TRIM(asset)) IN ('OSHIE F/S', 'OSHIE FS', 'OSHIE F S', 'OSHIE F.S', 'OSHIES F/S', 'OSHIES FS')
   OR UPPER(TRIM(workflow_location)) IN ('OSHIE F/S', 'OSHIE FS', 'OSHIE F S', 'OSHIE F.S', 'OSHIES F/S', 'OSHIES FS');

-- 5. Merge TEBIDABA F/S variations with TEBIDABA
UPDATE material_requests 
SET asset = 'TEBIDABA', workflow_location = 'TEBIDABA'
WHERE UPPER(TRIM(asset)) IN ('TEBIDABA F/S', 'TEBIDABA FS', 'TEBIDABA F S', 'TEBIDABA F.S')
   OR UPPER(TRIM(workflow_location)) IN ('TEBIDABA F/S', 'TEBIDABA FS', 'TEBIDABA F S', 'TEBIDABA F.S');

-- 6. Merge OBAMA F/S variations with OBAMA
UPDATE material_requests 
SET asset = 'OBAMA', workflow_location = 'OBAMA'
WHERE UPPER(TRIM(asset)) IN ('OBAMA F/S', 'OBAMA FS', 'OBAMA F S', 'OBAMA F.S')
   OR UPPER(TRIM(workflow_location)) IN ('OBAMA F/S', 'OBAMA FS', 'OBAMA F S', 'OBAMA F.S');

-- 7. Merge OGBOINBIRI variations
UPDATE material_requests 
SET asset = 'OGBOINBIRI', workflow_location = 'OGBOINBIRI'
WHERE UPPER(TRIM(asset)) IN ('OGBOIBIRI', 'OGBOINBIRI GAS PLANT', 'OGBOINBIRI GAS')
   OR UPPER(TRIM(workflow_location)) IN ('OGBOIBIRI', 'OGBOINBIRI GAS PLANT', 'OGBOINBIRI GAS');

-- 8. Merge EOC/IDU with IDU
UPDATE material_requests 
SET asset = 'IDU', workflow_location = 'IDU'
WHERE UPPER(TRIM(asset)) IN ('EOC/IDU', 'EOC IDU', 'EOC-IDU')
   OR UPPER(TRIM(workflow_location)) IN ('EOC/IDU', 'EOC IDU', 'EOC-IDU');

-- 9. Merge OBOB variations
UPDATE material_requests 
SET asset = 'OBOB', workflow_location = 'OBOB'
WHERE UPPER(TRIM(asset)) IN ('OBOB EOC', 'OBOB-EOC', 'OBOB/EOC', 'OBOB EOC KGP', 'OBOB-EOC-KGP', 'OBOB/EOC/KGP')
   OR UPPER(TRIM(workflow_location)) IN ('OBOB EOC', 'OBOB-EOC', 'OBOB/EOC', 'OBOB EOC KGP', 'OBOB-EOC-KGP', 'OBOB/EOC/KGP');

-- 10. Merge BRASS variations
UPDATE material_requests 
SET asset = 'BRASS TERMINAL', workflow_location = 'BRASS TERMINAL'
WHERE UPPER(TRIM(asset)) IN ('BRASS AND OGB', 'BRASS & OGB')
   OR UPPER(TRIM(workflow_location)) IN ('BRASS AND OGB', 'BRASS & OGB');

-- Verify changes
SELECT DISTINCT asset, COUNT(*) as count 
FROM material_requests 
WHERE UPPER(asset) LIKE '%IDU%' OR UPPER(asset) LIKE '%IRRI%' OR UPPER(asset) LIKE '%OSHIE%' 
   OR UPPER(asset) LIKE '%SAMABRI%' OR UPPER(asset) LIKE '%SAMABIRI%'
GROUP BY asset
ORDER BY asset;

