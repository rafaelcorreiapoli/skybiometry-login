import waterfall from 'promise-waterfall'

export default class LoginBiometry {
  ERROR_NO_PICTURE = 'ERROR_NO_PICTURE'
  ERROR_NO_FACES = 'ERROR_NO_FACES'
  ERROR_THRESHOLD = 'ERROR_THRESHOLD'
  ERROR_NO_CANDIDATES = 'ERROR_NO_CANDIDATES'
  NAMESPACE_SEPARATOR = '@'
  constructor(client, namespace, options = { debug: false }) {
    this.client = client
    this.namespace = namespace
    this.options = options
  }

  log(what) {
    if (this.options.debug) {
      console.log(what)
    }
  }

  registerFaceForUser(uid, url, customOptions) {
    this.log('Detectando face...');

    /**
     * First step: Detect a face in a photo and get it's temporaryId
     */
    const detect = () => this.client.faces.detect({
      urls: url,
      detector: 'aggressive',
      attributes: 'none',
      ...customOptions,
    })

    /**
     * Second step: Save that tag to a specific user
     */
    const saveTag = (res) => {
      return new Promise((resolve, reject) => {
        if (!res.photos.length) {
          console.log('throwing!')
          reject(this.ERROR_NO_PICTURE);
        }

        const photo = res.photos[0];

        if (!photo.tags.length) {
          reject(this.ERROR_NO_FACES);
        }

        const tag = photo.tags[0]

        const tempTagId = tag.tid;

        this.client.tags.save({
          uid: this._buildNamespaceForUser(uid),
          tids: tempTagId,
        })
        .then(res => resolve(res))
        .catch(err => reject(err))
      })
    }

    /**
     * Third step: Train that user
     */
    const trainFace = () => {
      this.log('Treinando usuário')
      return this.client.faces.train({
        uids: this._buildNamespaceForUser(uid),
      })
    }


    //  return waterfall([detect, saveTag, trainFace])

    let tid = ''
    return this.client.faces.detect({
      urls: url,
      detector: 'aggressive',
      attributes: 'none',
      ...customOptions,
    })
    .then(res => {
      if (!res.photos.length) {
        console.log('throwing!')
        throw new Error(this.ERROR_NO_PICTURE);
      }

      const photo = res.photos[0];

      if (!photo.tags.length) {
        throw new Error(this.ERROR_NO_FACES);
      }

      const tag = photo.tags[0]

      const tempTagId = tag.tid;

      return this.client.tags.save({
        uid: this._buildNamespaceForUser(uid),
        tids: tempTagId,
      })
    })
    .then(res => {
      const savedTags = res.saved_tags
      tid = savedTags[0].tid
      return this.client.faces.train({
        uids: this._buildNamespaceForUser(uid),
      }).then(res => ({
        status: res.status,
        tid,
      }))
    })
  }

  /**
   * Helpers
   */
  _buildNamespaceForUser(user) {
    return `${user}${this.NAMESPACE_SEPARATOR}${this.namespace}`
  }
  _getUidFromNamespacedString(namespacedString) {
    const separatorIndex = namespacedString.indexOf(this.NAMESPACE_SEPARATOR)
    if (separatorIndex === -1) {
      throw new Error(`${this.NAMESPACE_SEPARATOR} not found`)
    }
    return namespacedString.substr(0, separatorIndex);
  }

  _buildNamespacedUserList(users = []) {
    return users.map(uid => this._buildNamespaceForUser(uid))
      .join(',')
  }
  authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions) {
    const uids = this._buildNamespacedUserList(usersToCompare)

    this.log('Reconhecendo faces... uids->', uids);

    const recognize = () => this.client.faces.recognize({
      uids,
      urls,
      detector: 'aggressive',
      attributes: 'none',
      limit: 1,
      ...customOptions,
    })

    const authenticate = (res) => {
      if (!res.photos.length) {
        throw new Error(this.ERROR_NO_PICTURE);
      }

      const photo = res.photos[0];

      if (!photo.tags.length) {
        throw new Error(this.ERROR_NO_FACES);
      }

      const tag = photo.tags[0]
      const tempTagId = tag.tid

      const candidates = tag.uids

      if (!candidates.length) {
        throw new Error(this.ERROR_NO_CANDIDATES)
      }
      candidates.map(candidate => ({
        uid: this._getUidFromNamespacedString(candidate.uid),
        confidence: candidate.confidence,
      }))

      const bestCandidate = candidates[0]
      this.log(bestCandidate)
      if (bestCandidate.confidence < threshold) {
        throw new Error(this.ERROR_THRESHOLD)
      }
      return {
        uid: this._getUidFromNamespacedString(bestCandidate.uid),
        confidence: bestCandidate.confidence,
      }
    }

    const saveTagForBestCandidate = ({ bestCandidate, tempTagId }) =>
      new Promise((resolve, reject) => {
        this.client.tags.save({
          uid: bestCandidate.uid,
          tids: tempTagId,
        })
        .then(() => resolve(bestCandidate.uid))
        .catch(reject)
      })

    const trainFace = uid => this.client.faces.train({
      uids: uid,
    })

    return waterfall([recognize, authenticate]) //  , saveTagForBestCandidate, trainFace])
  }

  removeFaceForUser(tid) {
    return this.client.tags.remove({
      tids: tid
    })
  }
}
