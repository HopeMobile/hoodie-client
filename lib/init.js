module.exports = init

function init (hoodie) {
  // see https://github.com/hoodiehq/hoodie-client-account/issues/65
  // for info on the internal before:* & after:* events
  hoodie.account.on('before:signout', function (options) {
    options.hooks.push(function () {
      return hoodie.store.push()
    })
  })
  hoodie.account.on('after:signout', function (options) {
    options.hooks.push(function () {
      return hoodie.store.reset({ name: hoodie.account.id })
    })
  })

  // In order to prevent data loss, we want to move all data that has been
  // created without an account (e.g. while offline) to the user’s account
  // on signin. So before the signin happens, we temporarily store it in
  // a variable (dataFromAccountBeforeSignin) and add it to the store again
  // in the after:signin hook below
  var dataFromAccountBeforeSignin
  hoodie.account.on('before:signin', function (options) {
    options.hooks.push(function () {
      return hoodie.store.findAll().then(function (objects) {
        dataFromAccountBeforeSignin = objects
      })
    })
  })

  hoodie.account.on('after:signin', function (options) {
    options.hooks.push(function () {
      return hoodie.store.reset({ name: hoodie.account.id })

      .then(function () {
        var migratedDataFromAccountBeforeSignIn = dataFromAccountBeforeSignin.map(function (object) {
          object.createdBy = hoodie.account.id
          delete object._rev
          return object
        })
        hoodie.store.add(migratedDataFromAccountBeforeSignIn)
      })

      .then(hoodie.store.connect)
    })
  })

  hoodie.account.on('unauthenticate', hoodie.store.disconnect)
  hoodie.account.on('reauthenticate', hoodie.store.connect)
  hoodie.connectionStatus.on('disconnect', function () {
    if (!hoodie.account.isSignedIn()) {
      return
    }
    hoodie.store.disconnect()
  })
  hoodie.connectionStatus.on('connect', function () {
    if (!hoodie.account.isSignedIn()) {
      return
    }
    hoodie.store.connect()
  })

  // hoodie.connectionStatus.ok is false if there is a connection issue
  if (hoodie.account.isSignedIn() && hoodie.connectionStatus.ok !== false) {
    hoodie.store.connect()
  }
}
