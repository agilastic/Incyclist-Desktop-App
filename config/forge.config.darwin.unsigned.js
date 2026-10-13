const updateWebBundle = require('../scripts/update-web-bundle')

module.exports = {
  hooks: {
    prePackage: async (options) => { 
      await updateWebBundle()        
    }
  },
  packagerConfig: {
    asar: true,
    appBundleId: 'com.incyclist.desktop',
    name: 'ForkyCyclist',
    icon: 'res/icons/incyclist',
    // macOS only lets an app watch the Downloads folder (Workout Inbox) after asking the user - without this text it denies silently
    extendInfo: {
      NSDownloadsFolderUsageDescription: 'ForkyCyclist imports workouts (.zwo) that you download into your Downloads folder.'
    },
    ignore: [ '^/.github','^/.gitignore', '^/app-tests','^coverage','^/certs', '^/entitlements','^/profiles','^/bin','^/installer','^/release','scripts','^/config','^/test','^/test-results','^/testdata','README.MD','electron-builder.yml','^/.env']
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO'
      },
      platforms: ['darwin'],
    }
  ]
};
