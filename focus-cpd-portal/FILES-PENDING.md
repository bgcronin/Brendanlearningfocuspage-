# CPD portal merge — remaining files to download from Google Drive

The Google Drive connection dropped mid-transfer. 16 of ~41 files are merged
(including package.json, package-lock.json, migration.sql, the admin pages,
certificate fonts and logo-color.png — verified byte-exact against Drive).
The files below are still in Drive folder "Focus CPD/focus-cpd-portal"
(folder ID 1-yMCo-UXcWOe94fg5itHc-BBWh1B2tpJ) and need to be fetched with
mcp__Google_Drive__download_file_content (returns base64), path ← fileId:

- vite.config.js ← 173ZwsSxwZj8P_NE6vLf3sbCF2pCON9M_
- netlify.toml ← 140_KsejexqizY49nYWGggO0VIn_S67qL
- index.html ← 1OGxIWE7gMeaLSbqxG_TZIVYmfEd1uTye
- postcss.config.js ← 1qMhiz4K3mt4a3clZ4CEuoEYE6TVKFWAQ
- src/App.jsx ← 1-0qcC77FO4F76lyHesc92_s2_DP2Mu-8
- src/main.jsx ← 1M8_mBX8VHpjcAiBmY1ofc0bCu8p4qdRO
- src/lib/demo.js ← 1MEWRGY84Rl0yJZkunxwNJaWDNOAgbDQ-
- src/lib/helpers.js ← 1ncKwOXIHGIdP-DO3gNMxUq-pSUFr2naI
- src/lib/supabase.js ← 1wySUwebFGtI3bEV_i91vc1KpFtFc_rSx
- src/context/AuthContext.jsx ← 1JzGoCx53AfporJUZzpcY9Wql0OmBSMl1
- src/components/Protected.jsx ← 16GaMEdCvwnvmYUUY6xaWi0L6oO1T_Its
- src/components/Certificate.jsx ← 1h334_TWjZlvYMxmwVnyoE41bEeMwLl22
- src/components/Layout.jsx ← 1-jO3LQpskR-xib0tXzGxZbMDeah-D8wM
- src/components/AdminNav.jsx ← 1wo0kuniKszaUjFO0AhjHJVxOpMGblHCO
- src/components/ReflectionEditor.jsx ← 1vydZAN_NdBR0PP5ZnfqhhJzlrEufKd_d
- src/pages/Register.jsx ← 1sDwbwq-QhA4nYjWXV6xIa_nqWUv0-jzQ
- src/pages/MyCpd.jsx ← 1_mw554XqggmccVxBtkaHV967O8xF5G9D
- src/pages/Login.jsx ← 1IvZWmc3h87l2FyhYHl1qzXp7rsxxm8bd
- src/pages/Catalogue.jsx ← 1ubyPaN2EJThsgqPi5Fs8f6D1C3FAk0a0
- src/pages/ResetPassword.jsx ← 1m7mSxY9S-qe120QIEmwhm44bm4B2ERPs
- src/pages/ForgotPassword.jsx ← 1z361cwH3ul7A_W9MZR60A0MkM5Y7hAJX
- src/pages/VerifyCertificate.jsx ← 1KZYrlMVddrNVr7QXKYR396dj3LSS39cl
- src/pages/Profile.jsx ← 1BwKGPlOsd3zqh2VTwnL7kBtLNGpl4zn9
- src/pages/Privacy.jsx ← 1F_VO12ruz5cGy5iP-s6L_ooqVDypbEdD
- src/assets/logo-white.png ← 1xrdkmo-q8UnKsXF-Yn2ZOY8lxs9WHVWB (binary)
- public/logo-white.png ← 1skp-6niXF-OSH1HAKV-eBVGYsd7_ONZ7 (binary, same bytes)
- supabase/seed.sql ← 1AMEgyDioRO5BMIznBPHWdUNay5CbbrDF
- supabase/upgrade.sql ← 1zitZ9sltovPkZLwBDVTo_gwyfSP9mC5B
- supabase/upgrade2.sql ← 1ly2yRXPWPRowAdYUdSYPCgkfS-M8hqva
- supabase/upgrade3.sql ← 1BljLz8G5CX83_cVsz7RBHK-uNWAVnDyn
- netlify/functions/issue-certificate.mjs ← 1W6kysK-FoKB34Lx9aDlUUPGONdQbqcpF

Also verify completeness of src/pages/admin/ (folder 1Q5ZG0bBsLfziB4ScfcVjxKggy5BJezUw —
4 files downloaded) and netlify/functions/assets/ (folder 1gbdtnQ-TUqiNcnszUEGGcz8_rN30Xk14 —
2 fonts downloaded) by listing those folders again.

Delete this file once the merge is complete.
