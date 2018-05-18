import axios from 'axios'
import './promise.prototype.finalCatch'
import qs from './qs'
import config from '../config'
import { notify, NOTIFY_TYPE } from '../components/Notification/actions'

const _request = axios.create({
  baseURL: config.baseURL,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(config.isPlatform && {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/vnd.coding.v2+json'
    })
  },
  mode: 'cors',
  withCredentials: true,
  // only applicable for request methods 'PUT', 'POST', and 'PATCH'
  transformRequest: [function (data, headers) {
    switch (headers['Content-Type']) {
      case 'application/json':
        return JSON.stringify(data)
      case 'application/x-www-form-urlencoded':
        return qs.stringify(data)
      default:
        return data
    }
  }]
})

const request = function (options) {
  // I need to intercept the returned promise
  // axios provides no way to do it, so I need this wrapper layer
  return promiseInterceptor(_request(options))
}

Object.assign(request, _request)

const promiseInterceptor = (promise) => {
  promise.finalCatch((err) => {
    if (err.msg) {
      notify({
        notifyType: NOTIFY_TYPE.ERROR,
        message: err.response.data.msg,
      })
    } else {
      throw err
    }
  })
  return promise
}

const requestInterceptor = request.interceptors.request.use((options) => {
  if (config.isPlatform && config.spaceKey && config.spaceKey !== 'default') {
    options.headers['X-Space-Key'] = config.spaceKey
    options.headers['X-Global-Key'] = config.globalKey
  }
  return options
})

const responseRedirect = function (response) {
  if (config.isPlatform && response && response.headers['requests-auth'] === '1') {
    const authUrl = response.headers['requests-auth-url']
    location.href = authUrl
  }
}

const responseInterceptor = request.interceptors.response.use((response) => {
  responseRedirect(response)
  return response.data
}, (error) => {
  responseRedirect(error.response)
  if (error.response && error.response.data) Object.assign(error, error.response.data)
  return Promise.reject(error)
})

request.get = function (url, params, options = {}) {
  return request({
    method: 'get',
    url,
    params,
    ...options,
  })
}

request.upload = function (url, data, options) {
  return request({
    method: 'POST',
    transformRequest: d => d,
    url,
    data,
    ...options,
  })
}

request.delete = function (url, params, options = {}) {
  return request({
    method: 'delete',
    url,
    params,
    ...options,
  })
}

request.diff = function (url, params, options = {}) {
  return request({
    url,
    params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(config.isPlatform && {
        Accept: 'application/vnd.coding.v2.diff+json'
      })
    },
    ...options,
  })
}

request.diffFilesList = function (url, params, options = {}) {
  return request({
    url,
    params,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(config.isPlatform && {
        Accept: 'application/vnd.coding.v2.diff-files-list+json'
      })
    },
    ...options,
  })
}

request.raw = function (options) {
  return axios(options)
}

request.postJSON = function (url, data, options = {}) {
  return request({
    method: 'post',
    url,
    data,
    headers: {
      'Content-Type': 'application/json',
      ...(config.isPlatform && {
        Accept: 'application/vnd.coding.v2+json'
      })
    },
    ...options,
  })
}

request.download = function (url, filename, params, options = {}) {
  return request({
    method: 'get',
    responseType: 'blob',
    url,
    params,
    ...options,
  }).then((response) => {
    if (typeof window.navigator.msSaveBlob !== 'undefined') {
      // IE workaround for "HTML7007: One or more blob URLs were 
      // revoked by closing the blob for which they were created. 
      // These URLs will no longer resolve as the data backing 
      // the URL has been freed."
      window.navigator.msSaveBlob(response, filename)
    } else {
      const blobURL = window.URL.createObjectURL(response)
      const tempLink = document.createElement('a')
      tempLink.style.display = 'none'
      tempLink.href = blobURL
      tempLink.setAttribute('download', filename)
      
      // Safari thinks _blank anchor are pop ups. We only want to set _blank
      // target if the browser does not support the HTML5 download attribute.
      // This allows you to download files in desktop safari if pop up blocking 
      // is enabled.
      if (typeof tempLink.download === 'undefined') {
        tempLink.setAttribute('target', '_blank')
      }
    
      document.body.appendChild(tempLink)
      tempLink.click()
      document.body.removeChild(tempLink)
      window.URL.revokeObjectURL(blobURL)
    }
  })
}

request.axios = axios

export default request
