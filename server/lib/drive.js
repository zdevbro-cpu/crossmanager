// 구글 드라이브 저장소 — 문서 실물은 드라이브, 링크·메타는 DB.
//
// 설계 근거: 크로스특수 통합관리시스템 상세설계서 v0.2
//   - 9.4  민감정보 접근 통제 — 열람·다운로드는 앱이 중계해야 기록이 남는다
//   - 10.4 로깅
//
// 지켜야 할 제약 3가지
//   1) 서비스 계정이 아니라 OAuth 리프레시 토큰을 쓴다.
//      서비스 계정은 자체 저장 용량이 없어 storageQuotaExceeded 가 난다.
//   2) 버전 관리를 드라이브 리비전에 맡기지 않는다.
//      바이너리 리비전은 keepForever 미지정 시 30일 후 자동 삭제되고,
//      keepForever 를 걸어도 200개가 상한이라 과거 버전이 조용히 사라진다.
//      버전마다 새 파일을 올리고 계보는 document_versions 가 관리한다.
//   3) 드라이브 링크를 화면에 노출하지 않는다.
//      링크를 그대로 주면 앱을 거치지 않은 열람이 생겨 감사 로그가 빈다.
//      그래서 webViewLink 를 반환하지 않고 downloadFromDrive 로 중계한다.

const { google } = require('googleapis')
const { Readable } = require('stream')

let driveClient = null

function getDriveClient() {
    if (driveClient) return driveClient

    const {
        GOOGLE_OAUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET,
        GOOGLE_OAUTH_REDIRECT_URI,
        GOOGLE_OAUTH_REFRESH_TOKEN
    } = process.env

    if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
        throw new Error(
            'Drive OAuth 설정이 없습니다. GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / ' +
            'GOOGLE_OAUTH_REFRESH_TOKEN 을 설정하세요. (Server/scripts/get-refresh-token.js 참고)'
        )
    }

    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_OAUTH_CLIENT_ID,
        GOOGLE_OAUTH_CLIENT_SECRET,
        GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:8081'
    )
    oauth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN })

    driveClient = google.drive({ version: 'v3', auth: oauth2Client })
    return driveClient
}

// 설정 여부만 확인한다. 라우터에서 드라이브 사용 가능 여부를 판단할 때 쓴다.
function isDriveConfigured() {
    return !!(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    )
}

// 토큰 만료를 알아보기 쉬운 문구로 바꾼다.
// 게시 상태가 '테스트 중'인 앱의 리프레시 토큰은 7일마다 만료된다.
// 원래 오류(invalid_grant)만으로는 원인을 알기 어렵다.
function wrapAuthError(e) {
    const msg = String(e && e.message || '')
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired')) {
        return new Error(
            '드라이브 토큰이 만료되었습니다. 게시 상태가 「테스트 중」인 앱은 7일마다 만료됩니다. ' +
            'Server 에서 `node scripts/get-refresh-token.js` 를 실행해 재발급한 뒤 ' +
            '.env 와 env_customer.env 의 GOOGLE_OAUTH_REFRESH_TOKEN 을 교체하십시오.'
        )
    }
    return e
}

// 파일 1건을 드라이브에 올리고 { driveFileId, fileName } 을 돌려준다.
// webViewLink 는 일부러 반환하지 않는다 — 제약 3) 참고.
async function uploadToDrive({ buffer, fileName, mimeType }) {
    const drive = getDriveClient()
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    try {
        const res = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: folderId ? [folderId] : undefined
            },
            media: {
                mimeType,
                body: Readable.from(buffer)
            },
            fields: 'id, name',
            // 공유 드라이브로 옮겨도 코드를 고치지 않도록 지금부터 켜 둔다.
            // 개인 드라이브에서는 무해하다.
            supportsAllDrives: true
        })

        return {
            driveFileId: res.data.id,
            fileName: res.data.name
        }
    } catch (e) {
        throw wrapAuthError(e)
    }
}

// 열람·다운로드는 앱이 중계한다. 스트림과 메타를 함께 돌려준다.
async function downloadFromDrive(fileId) {
    const drive = getDriveClient()

    try {
        const meta = await drive.files.get({
            fileId,
            fields: 'name, mimeType, size',
            supportsAllDrives: true
        })

        const res = await drive.files.get(
            { fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
        )

        return { stream: res.data, ...meta.data }
    } catch (e) {
        throw wrapAuthError(e)
    }
}

// 잘못 올린 파일을 치운다. 영구 삭제가 아니라 휴지통으로 보내
// 실수로 지운 경우 드라이브에서 되살릴 수 있게 한다.
// 현장 문서는 레퍼런스이므로 삭제하지 않는다는 방침과도 맞물린다.
async function trashInDrive(fileId) {
    const drive = getDriveClient()
    await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true
    })
}

module.exports = {
    isDriveConfigured,
    uploadToDrive,
    downloadFromDrive,
    trashInDrive
}
