const { getLogServerUrl, getCrashReportUrl, getUpdateServerUrl, getSecretsServerUrl, getOAuthServerUrl } = require('./endpoints')

describe('endpoints', () => {
    const ENV_KEYS = ['LOG_SERVER_URL','CRASH_REPORT_URL','UPDATE_SERVER_URL','SECRETS_BASE_URL','OAUTH_SERVER_URL']
    let savedEnv

    beforeEach(() => {
        savedEnv = {}
        ENV_KEYS.forEach( k => { savedEnv[k] = process.env[k]; delete process.env[k] })
    })

    afterEach(() => {
        ENV_KEYS.forEach( k => {
            if (savedEnv[k]===undefined) delete process.env[k]
            else process.env[k] = savedEnv[k]
        })
    })

    test('no endpoint is configured by default', () => {
        const settings = {}

        expect(getLogServerUrl(settings)).toBeUndefined()
        expect(getCrashReportUrl(settings)).toBeUndefined()
        expect(getUpdateServerUrl(settings)).toBeUndefined()
        expect(getSecretsServerUrl(settings)).toBeUndefined()
        expect(getOAuthServerUrl(settings)).toBeUndefined()
    })

    test('reads endpoints from settings', () => {
        const settings = {
            logRest: { url: 'https://logs.example.com/api/v1/log' },
            updateServerUrl: 'https://updates.example.com',
            SECRET_SERVER_URL: 'https://secrets.example.com',
            oauthUrl: 'https://auth.example.com/'
        }

        expect(getLogServerUrl(settings)).toBe('https://logs.example.com/api/v1/log')
        expect(getUpdateServerUrl(settings)).toBe('https://updates.example.com')
        expect(getSecretsServerUrl(settings)).toBe('https://secrets.example.com')
        expect(getOAuthServerUrl(settings)).toBe('https://auth.example.com/')
    })

    test('reads endpoints from the environment', () => {
        process.env.LOG_SERVER_URL = 'https://logs.example.com/api/v1/log'
        process.env.UPDATE_SERVER_URL = 'https://updates.example.com'
        process.env.SECRETS_BASE_URL = 'https://secrets.example.com'
        process.env.OAUTH_SERVER_URL = 'https://auth.example.com/'

        expect(getLogServerUrl({})).toBe('https://logs.example.com/api/v1/log')
        expect(getUpdateServerUrl({})).toBe('https://updates.example.com')
        expect(getSecretsServerUrl({})).toBe('https://secrets.example.com')
        expect(getOAuthServerUrl({})).toBe('https://auth.example.com/')
    })

    test('settings take precedence over the environment', () => {
        process.env.UPDATE_SERVER_URL = 'https://env.example.com'

        expect(getUpdateServerUrl({ updateServerUrl: 'https://settings.example.com' })).toBe('https://settings.example.com')
    })

    test('empty values count as not configured', () => {
        process.env.UPDATE_SERVER_URL = '  '

        expect(getUpdateServerUrl({ updateServerUrl: '' })).toBeUndefined()
    })

    describe('getCrashReportUrl', () => {
        test('derives the crash endpoint from the logging server', () => {
            expect(getCrashReportUrl({ logRest: { url: 'https://logs.example.com/api/v1/log' } })).toBe('https://logs.example.com/api/v1/crash')
        })

        test('prefers an explicitly configured crash endpoint', () => {
            const settings = { logRest: { url: 'https://logs.example.com/api/v1/log' }, crashReportUrl: 'https://crash.example.com/upload' }

            expect(getCrashReportUrl(settings)).toBe('https://crash.example.com/upload')
        })
    })
})
