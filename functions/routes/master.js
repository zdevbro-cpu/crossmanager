// Core 마스터 · SMS 라이브러리 API
//
// 근거: 크로스특수 통합관리시스템 상세설계서 v0.2 · 8장
//
// 다루는 것
//   코드체계 · 발주처 · 협력업체 · 위치(크로스 표준코드 + 발주처 매핑)
//   근로자 · 자격 · 만료 알림 · 공종 · 위험요인 라이브러리 · 제출 패키지
//
// 원칙
//   - 위치는 크로스 자체 코드가 정본이고, 발주처 표기는 매핑에서 끌어 쓴다.
//   - 자격 유효기간(expiry_watch)과 문서 보존연한(documents.retention_until)은
//     다른 개념이라 섞지 않는다(설계서 6.3).

const express = require('express')

const HQ_PROJECT_ID = '00000000-0000-0000-0000-000000000001'

const createMasterRouter = (pool) => {
    const router = express.Router()

    const fail = (res, err, msg) => {
        console.error('[master]', msg, err.message)
        res.status(500).json({ error: msg, details: err.message })
    }

    // ── 코드 ────────────────────────────────────────────────
    // 화면의 드롭다운은 전부 여기서 받아 간다. 코드값을 소스에 박지 않는다.
    router.get('/codes', async (req, res) => {
        try {
            const { group } = req.query
            const { rows } = await pool.query(`
                SELECT group_code, code, name, sort_order, attr
                  FROM code
                 WHERE is_active AND ($1::text IS NULL OR group_code = $1)
                 ORDER BY group_code, sort_order`, [group || null])
            res.json(rows)
        } catch (e) { fail(res, e, '코드 조회 실패') }
    })

    router.get('/code-groups', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT g.group_code, g.group_name, count(c.id)::int AS code_count
                  FROM code_group g LEFT JOIN code c ON c.group_code = g.group_code AND c.is_active
                 GROUP BY g.group_code, g.group_name ORDER BY g.group_code`)
            res.json(rows)
        } catch (e) { fail(res, e, '코드그룹 조회 실패') }
    })

    // ── 발주처 ──────────────────────────────────────────────
    router.get('/clients', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT c.*, (SELECT count(*)::int FROM client_profile p WHERE p.client_id = c.id) AS profile_count
                  FROM client c WHERE c.is_active ORDER BY c.name`)
            res.json(rows)
        } catch (e) { fail(res, e, '발주처 조회 실패') }
    })

    // 발주처가 요구하는 필수서류. 신규 현장 착수 시 이 목록이 체크리스트가 된다.
    router.get('/clients/:id/required-docs', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT r.*, p.profile_name, t.name AS doc_type_name
                  FROM client_required_doc r
                  JOIN client_profile p ON p.id = r.profile_id
             LEFT JOIN doc_type t ON t.doc_type_code = r.doc_type_code
                 WHERE p.client_id = $1 AND p.is_active
                 ORDER BY r.scope, r.sort_order`, [req.params.id])
            res.json(rows)
        } catch (e) { fail(res, e, '필수서류 조회 실패') }
    })

    // ── 협력업체 ────────────────────────────────────────────
    router.get('/companies', async (req, res) => {
        try {
            const { projectId } = req.query
            const { rows } = await pool.query(`
                SELECT c.*, sc.role_type, sc.status AS site_status
                  FROM company c
             LEFT JOIN site_company sc ON sc.company_id = c.id AND sc.project_id = $1::uuid
                 WHERE c.is_active AND ($1::uuid IS NULL OR sc.id IS NOT NULL)
                 ORDER BY c.name`, [projectId || null])
            res.json(rows)
        } catch (e) { fail(res, e, '업체 조회 실패') }
    })

    router.post('/companies', async (req, res) => {
        try {
            const { companyCode, name, bizRegNo, ceoName, companyType, phone, contactName, contactPhone } = req.body
            if (!companyCode || !name) return res.status(400).json({ error: '업체코드와 업체명은 필수입니다' })
            const { rows } = await pool.query(`
                INSERT INTO company (company_code, name, biz_reg_no, ceo_name, company_type, phone, contact_name, contact_phone)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
                [companyCode, name, bizRegNo || null, ceoName || null, companyType || 'PARTNER', phone || null, contactName || null, contactPhone || null])
            res.status(201).json(rows[0])
        } catch (e) {
            if (e.code === '23505') return res.status(409).json({ error: '이미 있는 업체코드입니다' })
            fail(res, e, '업체 등록 실패')
        }
    })

    // ── 위치·설비 ───────────────────────────────────────────
    // 크로스 자체 코드가 정본. clientId 를 주면 그 발주처 표기를 함께 돌려준다.
    router.get('/locations', async (req, res) => {
        try {
            const { projectId, clientId, prefix } = req.query
            const { rows } = await pool.query(`
                SELECT l.id, l.parent_id, l.level_type, l.code, l.full_code, l.name, l.sort_order,
                       lcc.client_code, lcc.client_name
                  FROM location l
             LEFT JOIN location_client_code lcc
                    ON lcc.location_id = l.id AND lcc.client_id = $2::bigint
                 WHERE l.deleted_at IS NULL AND l.is_active
                   AND ($1::uuid IS NULL OR l.project_id = $1)
                   AND ($3::text IS NULL OR l.full_code LIKE $3 || '%')
                 ORDER BY l.full_code`,
                [projectId || null, clientId || null, prefix || null])
            res.json(rows)
        } catch (e) { fail(res, e, '위치 조회 실패') }
    })

    router.post('/locations', async (req, res) => {
        try {
            const { projectId, parentId, levelType, code, name, sortOrder } = req.body
            if (!levelType || !code || !name) return res.status(400).json({ error: '단계·코드·명칭은 필수입니다' })

            // full_code 는 상위 경로를 이어붙여 만든다. 하위 전체 조회를 전방일치 한 번으로 처리하기 위함이다.
            let fullCode = code
            if (parentId) {
                const p = await pool.query('SELECT full_code FROM location WHERE id = $1', [parentId])
                if (p.rowCount === 0) return res.status(400).json({ error: '상위 위치를 찾을 수 없습니다' })
                fullCode = `${p.rows[0].full_code}-${code}`
            }
            const { rows } = await pool.query(`
                INSERT INTO location (project_id, parent_id, level_type, code, full_code, name, sort_order)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [projectId || null, parentId || null, levelType, code, fullCode, name, sortOrder || 0])
            res.status(201).json(rows[0])
        } catch (e) {
            if (e.code === '23505') return res.status(409).json({ error: '이미 있는 위치 코드입니다' })
            fail(res, e, '위치 등록 실패')
        }
    })

    // 발주처 표기 등록. 같은 장소를 발주처마다 다르게 부르는 것을 여기 담는다.
    router.put('/locations/:id/client-code', async (req, res) => {
        try {
            const { clientId, clientCode, clientName } = req.body
            if (!clientId) return res.status(400).json({ error: '발주처는 필수입니다' })
            const { rows } = await pool.query(`
                INSERT INTO location_client_code (location_id, client_id, client_code, client_name)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT (location_id, client_id)
                DO UPDATE SET client_code = EXCLUDED.client_code,
                              client_name = EXCLUDED.client_name,
                              updated_at = NOW()
                RETURNING *`, [req.params.id, clientId, clientCode || null, clientName || null])
            res.json(rows[0])
        } catch (e) { fail(res, e, '발주처 코드 등록 실패') }
    })

    // ── 근로자 ──────────────────────────────────────────────
    router.get('/workers', async (req, res) => {
        try {
            const { projectId, companyId } = req.query
            const { rows } = await pool.query(`
                SELECT w.*, co.name AS company_name, a.entry_status, a.blocked_reason,
                       (SELECT count(*)::int FROM worker_qualification q
                         WHERE q.worker_id = w.id AND q.deleted_at IS NULL) AS qual_count
                  FROM worker w
             LEFT JOIN company co ON co.id = w.company_id
             LEFT JOIN worker_site_assignment a ON a.worker_id = w.id AND a.project_id = $1::uuid
                 WHERE w.deleted_at IS NULL
                   AND ($1::uuid IS NULL OR a.id IS NOT NULL)
                   AND ($2::bigint IS NULL OR w.company_id = $2)
                 ORDER BY w.name`, [projectId || null, companyId || null])
            res.json(rows)
        } catch (e) { fail(res, e, '근로자 조회 실패') }
    })

    router.get('/workers/:id/qualifications', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT q.*, (q.expire_date - CURRENT_DATE) AS days_left
                  FROM worker_qualification q
                 WHERE q.worker_id = $1 AND q.deleted_at IS NULL
                 ORDER BY q.expire_date NULLS LAST`, [req.params.id])
            res.json(rows)
        } catch (e) { fail(res, e, '자격 조회 실패') }
    })

    // ── 만료 알림 ───────────────────────────────────────────
    // 만료는 곧 현장 반입 거부다. RA 자동화보다 현장 체감이 큰 항목(개요서 5.2).
    router.get('/expiries', async (req, res) => {
        try {
            const { projectId, days } = req.query
            const { rows } = await pool.query(`
                SELECT target_type, target_id, owner_type, owner_id, title,
                       expire_date, status, (expire_date - CURRENT_DATE) AS days_left
                  FROM expiry_watch
                 WHERE status IN ('WARNING','EXPIRED')
                   AND ($1::uuid IS NULL OR project_id = $1 OR project_id IS NULL)
                   AND ($2::int IS NULL OR expire_date - CURRENT_DATE <= $2)
                 ORDER BY expire_date`, [projectId || null, days ? Number(days) : null])
            res.json({
                expired: rows.filter(r => r.status === 'EXPIRED'),
                warning: rows.filter(r => r.status === 'WARNING')
            })
        } catch (e) { fail(res, e, '만료 조회 실패') }
    })

    // ── 공종 · 위험요인 라이브러리 ──────────────────────────
    router.get('/work-types', async (req, res) => {
        try {
            // 검수를 통과한 항목 수를 함께 준다.
            // 공종을 고를 때 담을 게 있는지 미리 알 수 있어야 한다.
            const { rows } = await pool.query(`
                SELECT w.*,
                       count(h.id) FILTER (WHERE h.active AND h.deleted_at IS NULL)::int AS active_count,
                       count(h.id) FILTER (WHERE NOT h.active AND h.deleted_at IS NULL)::int AS pending_count
                  FROM work_type w
             LEFT JOIN hazard_item h ON h.work_type_code = w.work_type_code
                 WHERE w.is_active
                 GROUP BY w.id
                 ORDER BY w.sort_order, w.name`)
            res.json(rows)
        } catch (e) { fail(res, e, '공종 조회 실패') }
    })

    // 항목 단위 검색. 문서 통째 복사는 제공하지 않는다(설계서 6.5).
    // 검수를 통과한(active) 항목만 노출한다.
    router.get('/hazard-items', async (req, res) => {
        try {
            const { workType, q, limit } = req.query
            const { rows } = await pool.query(`
                SELECT h.*, (h.frequency * h.severity) AS risk_value, w.name AS work_type_name
                  FROM hazard_item h
             LEFT JOIN work_type w ON w.work_type_code = h.work_type_code
                 WHERE h.deleted_at IS NULL AND h.active
                   AND ($1::text IS NULL OR h.work_type_code = $1)
                   AND ($2::text IS NULL OR h.hazard_desc ILIKE '%' || $2 || '%')
                 ORDER BY h.usage_count DESC, h.frequency * h.severity DESC
                 LIMIT $3`, [workType || null, q || null, Number(limit) || 50])
            res.json(rows)
        } catch (e) { fail(res, e, '위험요인 조회 실패') }
    })

    // ── 라이브러리 검수 ─────────────────────────────────────
    // 현장 RA 파일에서 추출한 항목은 곧바로 쓰지 않는다.
    // 검증되지 않은 위험요인이 법정 문서에 들어가면 되돌릴 수 없다(설계서 12.2.3).
    router.get('/hazard-items/pending', async (req, res) => {
        try {
            const { workType, hazardClass, hasGrade, q, limit, offset } = req.query
            const { rows } = await pool.query(`
                SELECT h.*, (h.frequency * h.severity) AS risk_value, w.name AS work_type_name
                  FROM hazard_item h
             LEFT JOIN work_type w ON w.work_type_code = h.work_type_code
                 WHERE h.deleted_at IS NULL AND NOT h.active
                   AND ($1::text IS NULL OR h.work_type_code = $1)
                   AND ($2::text IS NULL OR h.hazard_class = $2)
                   AND ($3::text IS NULL
                        OR ($3 = 'Y' AND h.grade IS NOT NULL)
                        OR ($3 = 'N' AND h.grade IS NULL))
                   AND ($4::text IS NULL OR h.hazard_desc ILIKE '%' || $4 || '%')
                 ORDER BY (h.grade IS NULL), h.usage_count DESC, h.id
                 LIMIT $5 OFFSET $6`,
                [workType || null, hazardClass || null, hasGrade || null, q || null,
                 Number(limit) || 50, Number(offset) || 0])

            const total = await pool.query(`
                SELECT count(*)::int n FROM hazard_item
                 WHERE deleted_at IS NULL AND NOT active
                   AND ($1::text IS NULL OR work_type_code = $1)
                   AND ($2::text IS NULL OR hazard_class = $2)
                   AND ($3::text IS NULL
                        OR ($3 = 'Y' AND grade IS NOT NULL)
                        OR ($3 = 'N' AND grade IS NULL))
                   AND ($4::text IS NULL OR hazard_desc ILIKE '%' || $4 || '%')`,
                [workType || null, hazardClass || null, hasGrade || null, q || null])

            res.json({ total: total.rows[0].n, items: rows })
        } catch (e) { fail(res, e, '검수 대기 조회 실패') }
    })

    // 검수하며 빠진 값을 채운다. 등급은 빈도x강도에서 다시 계산한다.
    router.patch('/hazard-items/:id', async (req, res) => {
        try {
            const { workTypeCode, hazardClass, hazardDesc, accidentTypeCode,
                    legalBasis, currentControl, reductionMeasure,
                    frequency, severity, active } = req.body

            const f = frequency == null ? null : Number(frequency)
            const s = severity == null ? null : Number(severity)
            let grade = null
            if (f >= 1 && f <= 5 && s >= 1 && s <= 5) {
                const v = f * s
                grade = v >= 20 ? 'A' : v >= 15 ? 'B' : v >= 10 ? 'C' : v >= 5 ? 'D' : 'E'
            }

            const { rows } = await pool.query(`
                UPDATE hazard_item SET
                    work_type_code     = COALESCE($2, work_type_code),
                    hazard_class       = COALESCE($3, hazard_class),
                    hazard_desc        = COALESCE($4, hazard_desc),
                    accident_type_code = COALESCE($5, accident_type_code),
                    legal_basis        = COALESCE($6, legal_basis),
                    current_control    = COALESCE($7, current_control),
                    reduction_measure  = COALESCE($8, reduction_measure),
                    frequency          = COALESCE($9, frequency),
                    severity           = COALESCE($10, severity),
                    grade              = COALESCE($11, grade),
                    active             = COALESCE($12, active),
                    updated_at         = NOW()
                 WHERE id = $1 AND deleted_at IS NULL
                RETURNING *`,
                [req.params.id, workTypeCode || null, hazardClass || null, hazardDesc || null,
                 accidentTypeCode || null, legalBasis || null, currentControl || null,
                 reductionMeasure || null, f, s, grade,
                 active === undefined ? null : !!active])

            if (rows.length === 0) return res.status(404).json({ error: '없는 항목입니다' })
            res.json(rows[0])
        } catch (e) { fail(res, e, '항목 수정 실패') }
    })

    // 여러 건을 한 번에 통과시킨다. 964건을 한 건씩 누르게 할 수는 없다.
    // 다만 등급 없는 항목은 통과시키지 않는다 - 평가서에 쓸 수 없기 때문이다.
    router.post('/hazard-items/activate', async (req, res) => {
        try {
            const ids = Array.isArray(req.body.ids) ? req.body.ids : []
            if (ids.length === 0) return res.status(400).json({ error: '선택된 항목이 없습니다' })
            const { rows } = await pool.query(`
                UPDATE hazard_item SET active = TRUE, updated_at = NOW()
                 WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL AND grade IS NOT NULL
                RETURNING id`, [ids])
            const skipped = ids.length - rows.length
            res.json({ activated: rows.length, skipped,
                       reason: skipped ? '등급이 없는 항목은 제외했습니다' : null })
        } catch (e) { fail(res, e, '일괄 활성화 실패') }
    })

    // 반려 - 물리 삭제하지 않는다. 잘못 반려한 것을 되살릴 수 있어야 한다.
    router.post('/hazard-items/reject', async (req, res) => {
        try {
            const ids = Array.isArray(req.body.ids) ? req.body.ids : []
            if (ids.length === 0) return res.status(400).json({ error: '선택된 항목이 없습니다' })
            const { rows } = await pool.query(
                'UPDATE hazard_item SET deleted_at = NOW() WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL RETURNING id',
                [ids])
            res.json({ rejected: rows.length })
        } catch (e) { fail(res, e, '반려 실패') }
    })

    router.get('/hazard-items/stats', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT count(*) FILTER (WHERE active)::int AS approved,
                       count(*) FILTER (WHERE NOT active)::int AS pending,
                       count(*) FILTER (WHERE NOT active AND grade IS NOT NULL)::int AS pending_with_grade,
                       count(*) FILTER (WHERE NOT active AND grade IS NULL)::int AS pending_no_grade
                  FROM hazard_item WHERE deleted_at IS NULL`)
            res.json(rows[0])
        } catch (e) { fail(res, e, '검수 현황 조회 실패') }
    })

    // 라인에 담을 때마다 사용 횟수를 올린다. 자주 쓰는 항목이 위로 오게 한다.
    router.post('/hazard-items/:id/use', async (req, res) => {
        try {
            const { rows } = await pool.query(
                'UPDATE hazard_item SET usage_count = usage_count + 1 WHERE id = $1 RETURNING usage_count',
                [req.params.id])
            if (rows.length === 0) return res.status(404).json({ error: '없는 항목입니다' })
            res.json(rows[0])
        } catch (e) { fail(res, e, '사용 기록 실패') }
    })

    // ── 제출 패키지 ─────────────────────────────────────────
    router.get('/submissions', async (req, res) => {
        try {
            const { projectId, status } = req.query
            const { rows } = await pool.query(`
                SELECT s.*, cl.name AS client_name,
                       count(i.id)::int AS item_count,
                       count(i.id) FILTER (WHERE i.status = 'MISSING' AND i.is_required)::int AS missing_count
                  FROM submission s
             LEFT JOIN client cl ON cl.id = s.client_id
             LEFT JOIN submission_item i ON i.submission_id = s.id
                 WHERE ($1::uuid IS NULL OR s.project_id = $1)
                   AND ($2::text IS NULL OR s.status = $2)
                 GROUP BY s.id, cl.name
                 ORDER BY s.created_at DESC`, [projectId || null, status || null])
            res.json(rows)
        } catch (e) { fail(res, e, '제출 조회 실패') }
    })

    // 작업 1건을 등록하면 발주처가 요구하는 서류 세트가 자동 전개된다(설계서 7.4).
    router.post('/submissions', async (req, res) => {
        const client = await pool.connect()
        try {
            const { projectId, clientId, packageCode, title, entityType, entityId, dueDate } = req.body
            if (!projectId || !title) return res.status(400).json({ error: '현장과 제목은 필수입니다' })

            await client.query('BEGIN')
            const s = await client.query(`
                INSERT INTO submission (project_id, client_id, package_code, title, entity_type, entity_id, due_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [projectId, clientId || null, packageCode || null, title, entityType || null, entityId || null, dueDate || null])
            const sid = s.rows[0].id

            // 발주처 프로파일의 필수서류를 항목으로 펼친다.
            await client.query(`
                INSERT INTO submission_item (submission_id, doc_type_code, doc_label, is_required, sort_order)
                SELECT $1, r.doc_type_code, r.doc_label, r.is_required, r.sort_order
                  FROM client_required_doc r
                  JOIN client_profile p ON p.id = r.profile_id AND p.is_active
                 WHERE p.client_id = $2
                   AND ($3::text IS NULL OR r.package_code IS NOT DISTINCT FROM $3)`,
                [sid, clientId || null, packageCode || null])

            // 이미 가진 문서로 자동 충족 판정. 작성자가 다시 만들 필요가 없다.
            await client.query(`
                UPDATE submission_item i
                   SET document_id = d.id, status = 'READY', updated_at = NOW()
                  FROM documents d
                 WHERE i.submission_id = $1 AND i.document_id IS NULL
                   AND d.doc_type_code = i.doc_type_code
                   AND d.project_id IN ($2::uuid, $3::uuid)
                   AND d.deleted_at IS NULL`, [sid, projectId, HQ_PROJECT_ID])

            // 필수 항목이 모두 채워지면 제출 가능 상태로 올린다.
            await client.query(`
                UPDATE submission SET status = 'READY', updated_at = NOW()
                 WHERE id = $1 AND NOT EXISTS (
                       SELECT 1 FROM submission_item
                        WHERE submission_id = $1 AND is_required AND status = 'MISSING')`, [sid])

            await client.query('COMMIT')

            const out = await pool.query(`
                SELECT i.*, t.name AS doc_type_name
                  FROM submission_item i
             LEFT JOIN doc_type t ON t.doc_type_code = i.doc_type_code
                 WHERE i.submission_id = $1 ORDER BY i.sort_order`, [sid])
            const st = await pool.query('SELECT status FROM submission WHERE id = $1', [sid])
            res.status(201).json({ submissionId: sid, status: st.rows[0].status, items: out.rows })
        } catch (e) {
            await client.query('ROLLBACK')
            fail(res, e, '제출 패키지 생성 실패')
        } finally {
            client.release()
        }
    })

    router.get('/submissions/:id/items', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT i.*, t.name AS doc_type_name, d.name AS document_name
                  FROM submission_item i
             LEFT JOIN doc_type t ON t.doc_type_code = i.doc_type_code
             LEFT JOIN documents d ON d.id = i.document_id
                 WHERE i.submission_id = $1 ORDER BY i.sort_order`, [req.params.id])
            res.json(rows)
        } catch (e) { fail(res, e, '제출 항목 조회 실패') }
    })

    // ── 문서유형 ────────────────────────────────────────────
    router.get('/doc-types', async (req, res) => {
        try {
            const { rows } = await pool.query(`
                SELECT t.*, p.retention_years AS policy_years, p.disposal_action
                  FROM doc_type t LEFT JOIN retention_policy p ON p.doc_type_code = t.doc_type_code
                 WHERE t.is_active ORDER BY t.category_code, t.sort_order, t.name`)
            res.json(rows)
        } catch (e) { fail(res, e, '문서유형 조회 실패') }
    })

    return router
}

module.exports = { createMasterRouter, HQ_PROJECT_ID }
