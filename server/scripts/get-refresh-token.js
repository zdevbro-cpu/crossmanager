// 최초 1회 실행: Google OAuth 동의 후 refresh token 을 발급받아 .env 에 넣을 값을 출력한다.
//
// 사용법
//   1) Server/.env 에 GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 을 먼저 넣는다
//   2) node scripts/get-refresh-token.js
//   3) 출력된 URL 을 브라우저에서 열고 shinsh4600 계정으로 로그인·동의
//   4) 콘솔에 찍힌 refresh_token 을 .env 의 GOOGLE_OAUTH_REFRESH_TOKEN 에 넣는다
//
// 주의: 여기서 인증한 계정이 업로드되는 모든 문서의 소유자가 된다.
//       법정 보존 문서와 개인정보가 쌓이므로 반드시 의뢰자(shinsh4600) 계정으로 인증할 것.

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const http = require('http')
const { google } = require('googleapis')

const {
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
} = process.env

if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 을 Server/.env 에 먼저 설정하세요.')
    process.exit(1)
}

const redirectUri = GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:8081'
const { hostname, port, pathname } = new URL(redirectUri)

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri
)

// 이미 '프로덕션'으로 게시된 클라이언트를 쓰므로 drive 범위 그대로 둔다.
// 게시된 앱의 리프레시 토큰은 만료되지 않는다.
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive']
})

console.log('\n아래 URL 을 브라우저에서 열고, 문서를 보관할 구글 계정(shinsh4600)으로 로그인·동의하세요:\n')
console.log(authUrl, '\n')

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${hostname}:${port}`)
    if (url.pathname !== pathname) {
        res.writeHead(404)
        res.end()
        return
    }

    const code = url.searchParams.get('code')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h1>인증 완료. 이 창을 닫고 터미널을 확인하세요.</h1>')

    try {
        const { tokens } = await oauth2Client.getToken(code)
        console.log('\n발급된 refresh_token (Server/.env 의 GOOGLE_OAUTH_REFRESH_TOKEN 에 넣으세요):\n')
        console.log(tokens.refresh_token, '\n')
    } catch (e) {
        console.error('\n토큰 발급 실패:', e.message, '\n')
    }

    server.close()
    process.exit(0)
})

server.listen(Number(port), () => {
    console.log(`콜백 대기 중: ${redirectUri}`)
})
