'use strict';

var GenericProvider = require('butter-provider');
var querystring = require('querystring');
var Q = require('q');
var request = require('request');
var inherits = require('util').inherits;
var _ = require('lodash');
var Datastore = require('nedb');
var tnt_provider = require('./tnt');

var apiUrl = 'http://butter.TNT.net/popcorn';
var db = new Datastore();

function TNT() {
  if (!(this instanceof TNT)) {
    return new TNT();
  }

  GenericProvider.call(this);
}
inherits(TNT, GenericProvider);

TNT.prototype.config = {
  name: 'tnt',
  uniqueId: 'imdb_id',
  tabName: 'TNT',
  type: 'movie',
  /* should be removed */
  //subtitle: 'ysubs',
  metadata: 'trakttv:movie-metadata'
};

function formatForButter(items) {
  var results = {};
  var movieFetch = {};
  movieFetch.results = [];
  movieFetch.hasMore = (Number(items.length) > 1 ? true : false);
  _.each(items, function(movie) {
    if (movie.Quality === '3D') {
      return;
    }
    var imdb = movie.ImdbCode;

    // Calc torrent health
    var seeds = 0; //XXX movie.TorrentSeeds;
    var peers = 0; //XXX movie.TorrentPeers;

    var torrents = {};
    torrents[movie.Quality] = {
      url: movie.TorrentUrl,
      size: movie.SizeByte,
      filesize: movie.Size,
      seed: seeds,
      peer: peers
    };

    var ptItem = results[imdb];
    if (!ptItem) {
      ptItem = {
        imdb_id: imdb,
        title: movie.MovieTitleClean.replace(/\([^)]*\)|1080p|DIRECTORS CUT|EXTENDED|UNRATED|3D|[()]/g, ''),
        year: movie.MovieYear,
        genre: [movie.Genre],
        rating: movie.MovieRating,
        image: movie.CoverImage,
        cover: movie.CoverImage,
        backdrop: movie.CoverImage,
        torrents: torrents,
        subtitle: {}, // TODO
        trailer: false,
        synopsis: movie.Synopsis || 'No synopsis available.',
        type: 'movie'
      };

      movieFetch.results.push(ptItem);
    } else {
      _.extend(ptItem.torrents, torrents);
    }

    results[imdb] = ptItem;
  });

  return movieFetch.results;
}

TNT.prototype.extractIds = function(items) {
  return _.pluck(items.results, 'imdb_id');
};

TNT.prototype.updateAPI = function() {
  console.error('SONO DENRO UPDAT !!!')
  var self = this;
  var defer = Q.defer();
  console.info('Request to TNT');
  return tnt_provider
    .update()
    .then(function(data) {
      console.error(data)
      return data
        // request({
        //     uri: apiUrl,
        //     strictSSL: false,
        //     json: true,
        //     timeout: 10000
        //   },
        //   function(err, res, data) {
        /*
          data = _.map (helpers.formatForButter(data), function (item) {
          item.rating = item.rating.percentage * Math.log(item.rating.votes);
          return item;
          });
        */
      db.insert(formatForButter(data), function(err, newDocs) {
        if (err) {
          console.error('TNT.updateAPI(): Error inserting', err);
        }

        db.find({}).limit(2).exec(function(err, docs) {
          //console.debug('FIND ---->', err, docs);
        });
        defer.resolve(newDocs);
      });
    });

  // return defer.promise;
};

TNT.prototype.fetch = function(filters) {
  console.error('DENTRO FETCHIA !!!');
  var self = this;
  if (!self.fetchPromise) {
    self.fetchPromise = this.updateAPI();
  }

  var defer = Q.defer();
  var params = {
    sort: 'rating',
    limit: 50
  };
  var findOpts = {};

  if (filters.keywords) {
    findOpts = {
      title: new RegExp(filters.keywords.replace(/\s/g, '\\s+'))
    };
  }

  if (filters.genre) {
    params.genre = filters.genre;
  }

  if (filters.order) {
    params.order = filters.order;
  }

  if (filters.sorter && filters.sorter !== 'popularity') {
    params.sort = filters.sorter;
  }

  var sortOpts = {};
  sortOpts[params.sort] = params.order;

  self.fetchPromise.then(function(data) {
    console.error('demtrp qoifj sodfij soidf ')
      // db.find(findOpts)
      //   .sort(sortOpts)
      //   .skip((filters.page - 1) * params.limit)
      //   .limit(Number(params.limit))
      //   .exec(function(err, docs) {
      //     docs.forEach(function(entry) {
      //       entry.type = 'movie';
      //     });

    console.error('dentro DATA: ')
    console.error(data)
    return defer.resolve({
      results: data,
      hasMore: data.length ? true : false
    });
  });

  return defer.promise;
};

TNT.prototype.random = function() {
  var defer = Q.defer();

  function get(index) {
    var options = {
      uri: apiUrl + Math.round((new Date()).valueOf() / 1000),
      json: true,
      timeout: 10000
    };
    var req = _.extend(true, {}, apiUrl[index], options);
    request(req, function(err, res, data) {
      if (err || res.statusCode >= 400 || (data && !data.data)) {
        console.error('TNT API endpoint \'%s\' failed.', apiUrl);
        if (index + 1 >= apiUrl.length) {
          return defer.reject(err || 'Status Code is above 400');
        } else {
          get(index + 1);
        }
        return;
      } else if (!data || data.status === 'error') {
        err = data ? data.status_message : 'No data returned';
        return defer.reject(err);
      } else {
        return defer.resolve(Common.sanitize(data.data));
      }
    });
  }
  get(0);

  return defer.promise;
};

TNT.prototype.detail = function(torrent_id, old_data) {
  return Q(old_data);
};


module.exports = TNT