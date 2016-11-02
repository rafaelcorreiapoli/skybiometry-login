'use strict';

import chai from 'chai'
import SkyBiometryLogin from '../src/index';
import SkyBiometryClient from 'skybiometry-client'
import nock from 'nock'

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should()

const expect = chai.expect
const assert = chai.assert


const skyBiometryClient = new SkyBiometryClient('key', 'secret')
const skyBiometryLogin = new SkyBiometryLogin(skyBiometryClient, 'my-namespace')


describe('Sky Biometry Client', function() {
  it('should build correct string for user@namespace', function() {
    const skyBiometryLogin = new SkyBiometryLogin(skyBiometryClient, 'my-namespace')
    expect(skyBiometryLogin._buildNamespaceForUser('test')).to.equal('test@my-namespace')
  })
  it('should retrieve correct uid for given namespaced string', function() {
    const skyBiometryLogin = new SkyBiometryLogin(skyBiometryClient, 'my-namespace')
    expect(skyBiometryLogin._getUidFromNamespacedString('test@my-namespace')).to.equal('test')
  })
  it('should throw error for invalid namespaced string', function() {
    const skyBiometryLogin = new SkyBiometryLogin(skyBiometryClient, 'my-namespace')
    expect(() => skyBiometryLogin._getUidFromNamespacedString('testmy-namespace')).to.throw(Error)
  })
});

describe('Register face for user', function() {
  it('should throw error if no pictures return from api request', function() {
    const uid = 'myUserId'
    const url = 'http://placehold.it/400x400'
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .post(/faces\/detect/)
    .reply(200, {
      photos: []
    });
    nock('http://api.skybiometry.com/fc')
    .get(/tags\/save/)
    .reply(200);
    nock('http://api.skybiometry.com/fc')
    .get(/faces\/train/)
    .reply(200, {
      status: 'success'
    });

    const p = skyBiometryLogin.registerFaceForUser(uid, url, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_NO_PICTURE')
  })

  it('should throw error if no tags return from api request', function () {
    const uid = 'myUserId'
    const url = 'http://placehold.it/400x400'
    const customOptions = {}

    nock.cleanAll();

    nock('http://api.skybiometry.com/fc')
    .post(/faces\/detect/)
    .reply(200, {
      photos: [{
        tags: []
      }]
    });
    nock('http://api.skybiometry.com/fc')
    .get(/tags\/save/)
    .reply(200);
    nock('http://api.skybiometry.com/fc')
    .get(/faces\/train/)
    .reply(200, {
      status: 'success'
    });

    const p = skyBiometryLogin.registerFaceForUser(uid, url, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_NO_FACES')
  })



  it('should resolve promise a tag were returned', function() {
    const uid = 'myUserId'
    const url = 'http://placehold.it/400x400'
    const customOptions = {}

    nock.cleanAll()

    nock('http://api.skybiometry.com/fc')
    .post(/faces\/detect/)
    .reply(200, {
      photos: [{
        tags: [{
          tid: 'myTagId'
        }]
      }]
    });
    nock('http://api.skybiometry.com/fc')
    .get(/tags\/save/)
    .reply(200, {
      'status' : 'success',
      'saved_tags' : [
        {
          'detected_tid' : 'TEMP_F@0c95576847e9cd7123f1e304b1dcbe53_59ec9bb2ad15f_56.53_40.83_0_1',
          'tid' : 'b1dcbe53_59ec9bb2ad15f'
        }
      ],
      'message' : 'Tag saved with uid: mark@docs, label: '
    });
    nock('http://api.skybiometry.com/fc')
    .get(/faces\/train/)
    .reply(200, {
      status: 'success'
    });
    const p = skyBiometryLogin.registerFaceForUser(uid, url, customOptions)
    return p.should.eventually.deep.property('status', 'success')
  })
})


describe('authenticateUserByPhoto', function() {
  it('_buildNamespacedUserList', function() {
    const uids = ['rafa', 'pedro', 'joao']

    const value = skyBiometryLogin._buildNamespacedUserList(uids)
    const expected = 'rafa@my-namespace,pedro@my-namespace,joao@my-namespace'
    assert.equal(value, expected)
  })

  it('should throw error if no pictures return from api request', function() {
    const usersToCompare = ['rafa', 'pedro', 'joao']
    const urls = 'http://placehold.it/400x400'
    const threshold = 70
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .get(/faces\/recognize/)
    .reply(200, {
      photos: []
    });

    const p = skyBiometryLogin.authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_NO_PICTURE')
  })

  it('should throw error if no tags return from api request', function () {
    const usersToCompare = ['rafa', 'pedro', 'joao']
    const urls = 'http://placehold.it/400x400'
    const threshold = 70
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .get(/faces\/recognize/)
    .reply(200, {
      photos: [{
        tags: []
      }]
    });

    const p = skyBiometryLogin.authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_NO_FACES')
  })



  it('should throw error if no candidates return from api request', function () {
    const usersToCompare = ['rafa', 'pedro', 'joao']
    const urls = 'http://placehold.it/400x400'
    const threshold = 70
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .get(/faces\/recognize/)
    .reply(200, {
      photos: [{
        tags: [{
          uids: []
        }]
      }]
    });

    const p = skyBiometryLogin.authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_NO_CANDIDATES')
  })

  it('should throw error if best candidate does not has sufficient confidence', function () {
    const usersToCompare = ['rafa', 'pedro', 'joao']
    const urls = 'http://placehold.it/400x400'
    const threshold = 70
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .get(/faces\/recognize/)
    .reply(200, {
      photos: [{
        tags: [{
          uids: [{
            uid: 'rafa@my-namespace',
            confidence: 69,
          }]
        }]
      }]
    });

    const p = skyBiometryLogin.authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions)
    return expect(p).to.be.rejectedWith('ERROR_THRESHOLD')
  })

  it('should return user uid when authentication is valid', function() {
    const usersToCompare = ['rafa', 'pedro', 'joao']
    const urls = 'http://placehold.it/400x400'
    const threshold = 70
    const customOptions = {}

    nock('http://api.skybiometry.com/fc')
    .get(/faces\/recognize/)
    .reply(200, {
      photos: [{
        tags: [{
          uids: [{
            uid: 'rafa@my-namespace',
            confidence: 71,
          }]
        }]
      }]
    });

    const p = skyBiometryLogin.authenticateUserByPhoto(usersToCompare, urls, threshold, customOptions)
    return p.should.eventually.deep.equal({
      uid: 'rafa',
      confidence: 71,
    })
  })

  describe('removeFaceForUser', function() {
    it('should remove face for user', function() {
      const tid = 'b1dcbe53_59ec9bb2ad15f'

      nock('http://api.skybiometry.com/fc')
      .get(/tags\/remove/)
      .reply(200, {
        'status' : 'success',
        'removed_tags' : [
          {
            'removed_tid' : 'b1dcbe53_59ec9bb2ad15f',
            'tid' : 'b1dcbe53_59ec9bb2ad15f'
          }
        ],
        'message' : 'Tag removed'
      });

      const p = skyBiometryLogin.removeFaceForUser(tid)
      return p.should.eventually.deep.property('status', 'success')
    })
  })
})
