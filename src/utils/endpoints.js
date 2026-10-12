// Server endpoints used by the app.
//
// There are intentionally no built-in defaults: an endpoint is only used when it is
// configured in settings.json or via environment variable. If it is not configured,
// the feature that depends on it is disabled - the app never contacts the upstream
// incyclist.com servers on its own.
//
// | endpoint      | settings.json key    | environment variable |
// |---------------|----------------------|----------------------|
// | event logging | logRest.url          | LOG_SERVER_URL       |
// | crash reports | crashReportUrl       | CRASH_REPORT_URL     |
// | updates       | updateServerUrl      | UPDATE_SERVER_URL    |
// | secrets       | SECRET_SERVER_URL    | SECRETS_BASE_URL     |
// | OAuth         | oauthUrl             | OAUTH_SERVER_URL     |
//
// The update server is also used to download ffmpeg and the Windows BLE server.

const valid = (url) => (typeof url === 'string' && url.trim().length > 0) ? url.trim() : undefined

const getSettings = () => {
    try {
        // lazy require: AppSettings itself depends on utils
        return require('../features/AppSettings').getInstance().settings ?? {}
    }
    catch {
        return {}
    }
}

const getLogServerUrl = (settings = getSettings()) =>
    valid(settings?.logRest?.url) ?? valid(process.env.LOG_SERVER_URL)

const getCrashReportUrl = (settings = getSettings()) => {
    const explicit = valid(settings?.crashReportUrl) ?? valid(process.env.CRASH_REPORT_URL)
    if (explicit)
        return explicit
    // backwards compatible: crash reports go to the logging server's /crash endpoint
    return getLogServerUrl(settings)?.replace(/\/log$/, '/crash')
}

const getUpdateServerUrl = (settings = getSettings()) =>
    valid(settings?.updateServerUrl) ?? valid(process.env.UPDATE_SERVER_URL)

const getSecretsServerUrl = (settings = getSettings()) =>
    valid(settings?.SECRET_SERVER_URL) ?? valid(process.env.SECRETS_BASE_URL)

const getOAuthServerUrl = (settings = getSettings()) =>
    valid(settings?.oauthUrl) ?? valid(process.env.OAUTH_SERVER_URL)

module.exports = {
    getLogServerUrl,
    getCrashReportUrl,
    getUpdateServerUrl,
    getSecretsServerUrl,
    getOAuthServerUrl
}
