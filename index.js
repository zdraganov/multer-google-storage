var gcloud = require('@google-cloud/storage')
var crypto = require('crypto')

function getFilename (req, file, cb) {
  crypto.pseudoRandomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'))
  })
}

function getDestination (req, file, cb) {
  cb(null, '')
}

function getMetadata (req, file, cb) {
  cb(null, {})
}

function GCStorage (opts) {
  this.getFilename = (opts.filename || getFilename)
  this.getMetadata = (opts.getMetadata || getMetadata)

  if (typeof opts.destination === 'string') {
    this.getDestination = function ($0, $1, cb) { cb(null, opts.destination) }
  } else {
    this.getDestination = (opts.destination || getDestination)
  }

  opts.bucket = (opts.bucket || process.env.GCS_BUCKET || null)
  opts.projectId = opts.projectId || process.env.GCLOUD_PROJECT || null
  opts.keyFilename = opts.keyFilename || process.env.GCS_KEYFILE || null

  if (!opts.bucket) {
    throw new Error('You have to specify bucket for Google Cloud Storage to work.')
  }

  if (!opts.projectId) {
    throw new Error('You have to specify project id for Google Cloud Storage to work.')
  }

  if (!opts.keyFilename) {
    throw new Error('You have to specify credentials key file for Google Cloud Storage to work.')
  }

  this.gcobj = gcloud({
    projectId: opts.projectId,
    keyFilename: opts.keyFilename
  })

  this.gcsBucket = this.gcobj.bucket(opts.bucket)
  this.options = opts
}

GCStorage.prototype._handleFile = function (req, file, cb) {
  var self = this
  self.getDestination(req, file, function (err, destination) {
    if (err) {
      return cb(err)
    }

    self.getFilename(req, file, function (err, filename) {
      if (err) {
        return cb(err)
      }

      self.getMetadata(req, file, function (err, metadata) {
        if (err) {
          return cb(err)
        }

        var gcFile = self.gcsBucket.file(filename)

        file.stream.pipe(gcFile.createWriteStream({
          predefinedAcl: self.options.acl || 'private',
          metadata: metadata
        }))
        .on('error', function (err) {
          return cb(err)
        })
        .on('finish', function (file) {
          return cb(null, {
            path: 'https://storage.googleapis.com/' + self.options.bucket + '/' + filename,
            filename: filename
          })
        })
      })
    })
  })
}

GCStorage.prototype._removeFile = function _removeFile (req, file, cb) {
  var gcFile = this.gcsBucket.file(file.filename)
  gcFile.delete(cb)
}

module.exports = function (opts) {
  return new GCStorage(opts)
}
