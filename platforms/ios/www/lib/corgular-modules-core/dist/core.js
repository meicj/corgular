/*!
 * corgular-modules-core
 * https://github.com/meicj/corgular-modules-core
 * Version: 0.0.1 - 2016-03-11T12:08:36.089Z
 * License: MIT
 */


(function() {
    'use strict';

    angular.module('core', []);
})();

(function () {
    'use strict';

    /**
     * define factory of `debugHelper`
     */
    debugHelperRun.$inject = ['debugHelper', '$window'];
    angular
        .module('core')
        .factory('debugHelper', debugHelper)
        .run(debugHelperRun);

    /**
     * API of `debugHelper`
     * @ngInject
     */
    function debugHelper() {

        return {
            /**
             * get angular service on console
             * @returns {*}
             */
            get: function () {
                var injector = angular.element(document.body).injector();
                return injector.get.apply(injector.get, arguments);
            }
        };
    }

    /**
     * run `debugHelper`
     * @param debugHelper
     * @param $window
     * @ngInject
     */
    function debugHelperRun(debugHelper, $window) {
        $window._debugHelper = debugHelper;
    }

})();



(function () {
    'use strict';

    /**
     * define factory of `device`
     */
    device.$inject = ['$q', '$window', '$timeout', '$log'];
    angular
        .module('core')
        .factory('device', device);

    /**
     * API of `device`
     * @ngInject
     */
    function device($q, $window, $timeout, $log) {

        /**
         * cache the value of `is device ready`
         */
        var _isReady;

        return {
            /**
             * event of Cordova ready, means that the cordova plugins are ready to use.
             * @returns {promise}
             */
            ready: function () {
                var defer = $q.defer(),
                    timeout = 10 * 1000;

                if (_isReady) {
                    defer.resolve();
                } else {
                    $window.document.addEventListener("deviceready", function () {
                        $log.log('device is ready');
                        _isReady = true;
                        defer.resolve();
                    }, false);

                    $timeout(function () {
                        if (!_isReady) {
                            $log.error('ready: device was not ready after ' + timeout / 1000 + 's.');
                            defer.reject('device ready timeout');
                        }
                    }, timeout);
                }

                return defer.promise;
            }
        };
    }

})();



(function () {
    'use strict';

    handleWindowError.$inject = ['$injector'];
    handleAngularError.$inject = ['$provide'];
    handleHttpError.$inject = ['$httpProvider'];
    var __logger,
        __config;

    /**
     * init `exceptionHandler`
     */
    angular
        .module('core')
        .provider('exceptionHandler', exceptionHandlerProvider)
        .run(handleWindowError)
        .config(handleAngularError)
        .config(handleHttpError);

    /**
     * configure `exceptionHandler`
     */
    function exceptionHandlerProvider() {
        var _self = this; // jshint ignore:line

        /**
         * default http result error decider
         *
         * if http response JSON of {error_code:XX} that will be logged
         * @returns {string}
         */
        _self.isHttpResultError = function (httpResult) {
            return httpResult && httpResult.error_code;
        };

        /**
         * content
         * @type {{}}
         */
        _self.$get = {};

        /**
         * make accessible
         * @private
         */
        __config = _self;
    }

    /**
     * dynamic inject logger service to make logger can be custom by actual requirements
     * @param $injector {Object}
     * @returns {Object}
     */
    function injectLogger($injector) {

        var serviceName = 'logger';

        return __logger || (
                __logger = $injector.has(serviceName) &&
                    $injector.get(serviceName) || {
                        /**
                         * error logger function
                         * @param type {string}
                         *
                         *  Enum:
                         *  'window.error' - all of uncaught exception
                         *
                         *  'angular.error' - all of angular or called $log.error exception
                         *
                         *  `http.result.error` - all of http server response
                         *                        with {error_code:'something'} exception
                         *
                         *  'http.status.error' - all of http response status code
                         *                        aren't 200 exception,include timeout
                         *
                         * @param exception {Object} the object of error
                         * @param exception.message {string} exception message string
                         * @param {string} [exception.file] exception file path
                         * @param {number} [exception.line] exception file line number
                         * @param {string} [exception.remark] addition information
                         */
                        error: function (type, exception) {
                            console.warn(
                                'exceptionHandler: Implement `logger.error()` to log the error. ',
                                arguments
                            );
                        }
                    }
            );
    }

    /**
     * handle window.onerror event
     * @ngInject
     */
    function handleWindowError($injector) {

        var oldOnError = window.onerror;

        window.onerror = function (errorMsg, file, lineNumber) {

            // handler window error
            injectLogger($injector).error(
                'window.error',
                {message: errorMsg, file: file, line: lineNumber}
            );

            // call origin window.onerror
            if (oldOnError) {
                return oldOnError.call(this, arguments);
            }

            // keep origin invoke
            return false;
        };
    }

    /**
     * handle all the angular error. handle the errors called by $log.error(),
     * include all the angular inner error and manually invoked $log.error.
     * @param $provide
     * @ngInject
     */
    function handleAngularError($provide) {

        /**
         * decorate $log to handle $log.error call
         *
         * DESC：$exceptionHandler will call $log.error at last，so just need decorate $log
         */
        $logDecorator.$inject = ['$delegate', '$injector'];
        $provide.decorator("$log", $logDecorator);

        /**
         * doing decorator
         * @param $delegate
         * @param $injector
         * @returns {*}
         * @ngInject
         */
        function $logDecorator($delegate, $injector) {

            var oldError = $delegate.error;

            $delegate.error = function () {

                var exception,
                    messages = [],
                    messageSeparator = ' ';

                var toStr = function (o) {
                    return typeof o === 'string' ? o : JSON.stringify(o);
                };

                // 1.call origin window.onerror
                oldError.apply($delegate, arguments);

                // 2.concat error messages
                //  rules:
                //      1)concat multiple messages in sequence
                //      2)other properties based on the first object
                //          which own `message` property
                angular.forEach(arguments, function (arg) {

                    if (exception) {
                        exception.message += messageSeparator + toStr(arg);
                    } else if (angular.isObject(arg) && ('message' in arg)) {
                        exception = arg;
                        messages.push(exception.message);
                        exception.message = messages.join(messageSeparator);
                    } else {
                        messages.push(toStr(arg));
                    }

                });

                // 3.build error object
                if (!exception) {
                    exception = {message: messages.join(messageSeparator)};
                }

                // 4.call the logger
                injectLogger($injector).error('angular.error', exception);
            };

            return $delegate;
        }
    }

    /**
     * handle error of $http
     * @param $httpProvider
     * @ngInject
     */
    function handleHttpError($httpProvider) {

        $httpInterceptor.$inject = ['$q', '$window', '$injector'];
        $httpProvider.interceptors.push($httpInterceptor);

        /**
         * intercept http error
         * @param $q
         * @param $window
         * @param $injector
         * @returns {*}
         * @ngInject
         */
        function $httpInterceptor($q, $window, $injector) {
            return {
                /**
                 * record the time before request to help calc times cost
                 * @param config
                 * @returns {*}
                 */
                request: function (config) {
                    config._time_start = (new Date()).getTime();
                    return config;
                },
                /**
                 * log http result error
                 * if server return object with `error_code` property,
                 * we say it's an error
                 * @param response
                 * @param response.data
                 * @param response.data.error_code
                 * @param response.config
                 * @returns {*}
                 */
                response: function (response) {
                    var exception;
                    if (__config.isHttpResultError(response.data)) {
                        exception = {
                            file: response.config.url,
                            message: $window.JSON.stringify(response.data),
                            remark: $window.JSON.stringify({config: response.config})
                        };

                        // call the logger
                        injectLogger($injector).error('http.result.error', exception);
                    }
                    return response;
                },
                /**
                 * log http status error
                 * @param rejection
                 * @returns {promise}
                 */
                responseError: function (rejection) {
                    var exception,
                        time_end,
                        time_duration,
                        message,
                        remark;

                    // 1.format status error message
                    message = rejection.status || '';
                    if (rejection.statusText) {
                        message += '(' + rejection.statusText + ') ';
                    }
                    message = message || 'unknown';

                    // 1.1.if request was timeout, concat `timeout` into message
                    if (rejection.config._time_start) {
                        time_end = (new Date()).getTime();
                        time_duration = time_end - rejection.config._time_start;

                        if (rejection.config.timeout
                            && rejection.config.timeout != -1
                            && time_duration >= rejection.config.timeout) {
                            message += 'timeout';
                        }
                    }

                    // 2.addition information
                    remark = (time_duration ? 'duration: ' + time_duration + 'ms ' : '');
                    remark += $window.JSON.stringify(rejection);

                    // 3.build error object
                    exception = {
                        file: rejection.config.url,
                        message: message,
                        remark: remark
                    };

                    // 4.call the logger
                    injectLogger($injector).error('http.status.error', exception);

                    // 5.keep return
                    return $q.reject(rejection);
                }
            };
        }
    }

})();

(function () {
    'use strict';

    localDB.$inject = ['$q', '$log', 'device'];
    var __config;

    /**
     * define provider of `localDB`
     */
    angular
        .module('core')
        .provider('localDB', localDBProvider);

    /**
     * configure `localDB`
     * @ngInject
     */
    function localDBProvider() {
        var _self = this, // jshint ignore:line
            _dbProvider;

        /**
         * default DB name
         * @returns {string}
         */
        _self.getDefaultDBName = function () {
            return 'app';
        };
        /**
         * provider of DB-API
         * @returns {Object}
         */
        _self.getDBProvider = function () {
            return _dbProvider || (_dbProvider = window.sqlitePlugin);
        };
        /**
         * content
         * @type {localDB}
         */
        _self.$get = localDB;

        /**
         * make accessible for `localDB`
         * @type {localDBProvider}
         * @private
         */
        __config = _self;
    }

    /**
     * API of `localDB`
     * @ngInject
     */
    function localDB($q, $log, device) {
        var _private,
            _public,
            _config,
            _instance = {};

        /**
         * access the config of `localDB`
         */
        _config = __config;

        /**
         * private member
         */
        _private = {
            /**
             * touch the DB by name
             * @param {string|promise} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             * @private
             */
            getDB: function (dbName) {
                var defer;

                return $q
                    .when(device.ready())
                    .then(function () {
                        return dbName || _config.getDefaultDBName();
                    })
                    .then(function (dbName) {
                        defer = $q.defer();

                        if (!dbName) {
                            $log.error('_getDB：parameter of `dbName` was empty');
                            defer.reject('db name is empty');
                        } else if (_instance[dbName]) {
                            defer.resolve(_instance[dbName]);
                        } else {
                            _config.getDBProvider().openDatabase(
                                { name: dbName },
                                function (openedDb) {
                                    _instance[dbName] = openedDb;
                                    defer.resolve(openedDb);
                                },
                                function (error) {
                                    $log.error('_getDB:', error);
                                    defer.reject(error);
                                }
                            );
                        }

                        return defer.promise;
                    });
            },

            /**
             * execute sql in transaction
             * @param transaction {object} transaction object
             * @param sql {string} single sql text
             * @param parameters {Array} values array of sql parameters
             * @param successCallback {*|function} success callback
             * @param errorCallback {*|function} error callback
             * @private
             */
            transaction_executeSql: function (transaction, sql, parameters, successCallback, errorCallback) {
                transaction.executeSql(sql, parameters,
                    function (t, resultSet) {
                        successCallback && successCallback(resultSet, _private.buildTransaction(t));
                    },
                    function (t, error) {
                        $log.error('transaction_executeSql:', error, sql);
                        errorCallback && errorCallback(error && error.message, _private.buildTransaction(t));
                        return true;
                    });
            },

            /**
             * build the public transaction API object
             * @param transaction {Object|*} raw transaction object
             * @returns {Object}
             * @private
             */
            buildTransaction: function (transaction) {
                var tx = {};

                // commented code：does not recommend using `executeSql` for transaction directly
                /*_tx.executeSql = function (sql, parameters, successCallback, errorCallback) {
                 _transaction_executeSql(tx, sql, parameters, successCallback, errorCallback);
                 };*/
                tx.insert = function (tableName, columns, values, successCallback, errorCallback) {
                    _public.insert(tableName, columns, values, null, transaction, successCallback, errorCallback);
                };
                tx.update = function (tableName, columnsObj, conditionsObj, successCallback, errorCallback) {
                    _public.update(tableName, columnsObj, conditionsObj, transaction, successCallback, errorCallback);
                };
                tx.delete = function (tableName, conditionsObj, successCallback, errorCallback) {
                    _public.delete(tableName, conditionsObj, transaction, successCallback, errorCallback);
                };
                tx.exists = function (tableName, conditionsObj, successCallback, errorCallback) {
                    _public.exists(tableName, conditionsObj, null, transaction, successCallback, errorCallback);
                };

                return tx;
            },

            /**
             * build the sql portion of condition
             * @param conditionsObj {Object|*} condition map object
             * @returns {{sql: (string), values: Array}}
             * @throw {Error}
             * @private
             */
            buildConditionSql: function (conditionsObj) {
                var sqlConditions, conditionsValues;

                // 1.argument validation
                if (!angular.isObject(conditionsObj)) {
                    throw new Error('invalid argument');
                }

                // 2.build `where` sql
                sqlConditions = [];
                conditionsValues = [];
                for (var columnName in conditionsObj) {
                    if (conditionsObj.hasOwnProperty(columnName)) {
                        if (conditionsObj[columnName]
                            || conditionsObj[columnName] === 0
                            || conditionsObj[columnName] === ''
                        ) {
                            conditionsValues.push(conditionsObj[columnName]);
                            sqlConditions.push('"' + columnName + '" = ?');
                        } else {
                            throw new Error('condition[' + columnName + '] was empty');
                        }
                    }
                }
                if (sqlConditions.length === 0) {
                    throw new Error('invalid argument of `columnsObj`');
                }
                sqlConditions = sqlConditions.join(' and ');

                // 3.return
                return {
                    sql: sqlConditions,
                    values: conditionsValues
                };
            },

            /**
             * check object property whether has value
             * @param obj {object} object
             * @param prop {string} property name
             * @returns {*|boolean}
             * @private
             */
            checkObjPropHasValue: function (obj, prop) {
                return (obj[prop] || obj[prop] === 0);
            }
        };

        /**
         * public API
         */
        _public = {
            /**
             * execute sql and return the result sets object
             * @param sql {string} sql text
             * @param {Array} [parameters] optional，values array of sql parameters
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            executeSql: function (sql, parameters, dbName) {
                var callArguments = arguments,
                    defer;

                return $q.when(_private.getDB(dbName))
                    .then(function (db) {

                        defer = $q.defer();
                        db.executeSql(sql, parameters,
                            function (resultSet) {
                                defer.resolve(resultSet);
                            },
                            function (error) {
                                $log.error(
                                    'executeSql:', error, JSON.stringify(callArguments)
                                );
                                defer.reject(error && error.message);
                            });

                        return defer.promise;
                    });
            },

            /**
             * execute select sql and return the array of result row object
             * @param sql {string} sql text
             * @param {Array} [parameters] optional，values array of sql parameters
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            query: function (sql, parameters, dbName) {
                return _public.executeSql(sql, parameters, dbName).then(function (resultSet) {
                    return _public.getRowsToArray(resultSet.rows);
                });
            },

            /**
             * execute select sql and return the single result row object.
             *
             * NOTE: sql text don't need include `limit 1` extra
             *
             * @param sql {string} sql text
             * @param {Array} [parameters] optional，values array of sql parameters
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            queryOne: function (sql, parameters, dbName) {
                sql = sql + ' limit 1';

                return _public.executeSql(sql, parameters, dbName).then(function (resultSet) {
                    if (resultSet.rows && resultSet.rows.length) {
                        return resultSet.rows.item(0);
                    }
                });
            },

            /**
             * process the raw DB API rows object to javascript array of object
             * @param rows {object|*} the raw DB API rows object
             * @returns {Array} array of row object
             */
            getRowsToArray: function (rows) {
                var result = [];

                rows = rows || [];
                for (var i = 0, iLen = rows.length; i < iLen; i++) {
                    result[i] = rows.item(i);
                }

                return result;
            },

            /**
             * transaction function
             *
             * NOTICE: the code in `execFunction` must be synchronous
             *
             * @param execFunction {function} the function executes in transaction,
             *  called with the transaction db object parameter
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            transaction: function (execFunction, dbName) {
                var _execFunction = function (tx) {
                    var _tx = _private.buildTransaction(tx);

                    execFunction(_tx);
                };

                return _private.getDB(dbName)
                    .then(function (db) {
                        var defer = $q.defer();
                        db.transaction(_execFunction,
                            function (error) {
                                $log.error('transaction:', error);
                                defer.reject();
                            },
                            function (result) {
                                defer.resolve(result);
                            });
                        return defer.promise;
                    });
            },

            /**
             * decides whether exist any record in a table which matched the conditions
             * @param tableName {string} table name
             * @param conditionsObj {object} the conditions object
             * @param {string} [dbName] optional, only for none transaction
             * @param {*} [transaction] optional, process in a transaction
             * @param {*|function} [transactionSuccess] optional, transaction success callback
             *  called with the exist result parameter
             * @param {*|function} [transactionError] optional，transaction error callback
             * @returns {*|promise} `promise` for none transaction, `undefined` for transaction
             */
            exists: function (tableName, conditionsObj, dbName, transaction, transactionSuccess, transactionError) {
                var condition,
                    sqlConditions,
                    conditionsValues,
                    sql;

                var getIsExists = function (result) {
                    if (result && result.rows && result.rows.length) {
                        return !!result.rows.item(0).exists;
                    }
                    return false;
                };

                // 1.build `where` sql
                condition = _private.buildConditionSql(conditionsObj);
                sqlConditions = condition.sql;
                conditionsValues = condition.values;

                // 2.build complete sql
                sql = 'select 1 "exists" from ' + tableName + ' where ' + sqlConditions + ' limit 1';

                // 3.execute the sql
                if (transaction) {
                    return _private.transaction_executeSql(transaction, sql, conditionsValues, function (result, db) {
                        var exists = getIsExists(result);
                        transactionSuccess && transactionSuccess(exists, db);
                    }, transactionError);
                } else {
                    return _public.executeSql(sql, conditionsValues, dbName).then(function (result) {
                        return getIsExists(result);
                    });
                }
            },

            /**
             * insert single row into single table
             * @param tableName {string} table name
             * @param columns {Array} array of column name
             * @param values {Array} array of column value
             * @param {string} [dbName] optional, only for none transaction
             * @param {*} [transaction] optional, process in a transaction
             * @param {*|function} [transactionSuccess] optional, transaction success callback
             *  called with the exist result parameter
             * @param {*|function} [transactionError] optional，transaction error callback
             * @returns {*|promise} `promise` for none transaction, `undefined` for transaction
             */
            insert: function (tableName, columns, values, dbName, transaction, transactionSuccess, transactionError) {
                var sql;
                var sqlColumns;
                var sqlValues;

                // 1.argument validation
                if (!tableName || !tableName.length
                    || !angular.isArray(columns) || !columns.length
                    || !angular.isArray(values) || !values.length
                    || columns.length !== values.length) {
                    throw new Error('invalid arguments');
                }

                var getValueParamsDefine = function (values) {
                    var result = [];
                    values.forEach(function () {
                        result.push('?');
                    });
                    return result.join(',');
                };

                // 2.build sql
                sqlColumns = columns.join('","');
                sqlValues = getValueParamsDefine(values);
                sql = 'insert into ' + tableName + ' ( "' + sqlColumns + '" ) values ( ' + sqlValues + ' )';

                // 3.execute sql
                if (transaction) {
                    return _private.transaction_executeSql(transaction, sql, values, transactionSuccess, transactionError);
                } else {
                    return _public.executeSql(sql, values, dbName);
                }
            },

            /**
             * update a table'records
             * @param tableName {string} table name
             * @param columnsObj {object} the key-value pairs object of column name and column value
             * @param conditionsObj {object} the conditions object
             * @param {*} [transaction] optional, process in a transaction
             * @param {*|function} [transactionSuccess] optional, transaction success callback
             *  called with the exist result parameter
             * @param {*|function} [transactionError] optional，transaction error callback
             * @returns {*|promise} `promise` for none transaction, `undefined` for transaction
             */
            update: function (tableName, columnsObj, conditionsObj, transaction, transactionSuccess, transactionError) {
                var sql;
                var sqlColumns;
                var sqlConditions;
                var columnsValues;
                var conditionsValues;
                var values;
                var columnName;
                var condition;

                // 1.argument validation
                if (!tableName || !tableName.length
                    || !angular.isObject(columnsObj)
                    || !angular.isObject(conditionsObj)) {
                    throw new Error('invalid arguments');
                }

                // 2.build the update set columns sql
                sqlColumns = [];
                columnsValues = [];
                for (columnName in columnsObj) {
                    if (columnsObj.hasOwnProperty(columnName)) {
                        if (columnsObj[columnName] !== undefined) {
                            sqlColumns.push('"' + columnName + '" = ?');
                            columnsValues.push(columnsObj[columnName]);
                        } else {
                            throw new Error('column[' + columnName + '] was empty');
                        }
                    }
                }
                if (sqlColumns.length === 0) {
                    throw new Error('columnsObj invalid arguments');
                }
                sqlColumns = sqlColumns.join(' , ');

                // 3.build condition sql
                condition = _private.buildConditionSql(conditionsObj);
                sqlConditions = condition.sql;
                conditionsValues = condition.values;

                // 4.build complete sql
                sql = 'update ' + tableName + ' set ' + sqlColumns + '  where ' + sqlConditions;

                // 5.build the array of parameter value
                values = columnsValues.concat(conditionsValues);

                // 6.execute sql
                if (transaction) {
                    return _private.transaction_executeSql(transaction, sql, values, transactionSuccess, transactionError);
                } else {
                    return _public.executeSql(sql, values);
                }
            },

            /**
             * delete a table'records
             * @param tableName {string} table name
             * @param conditionsObj {object} the conditions object
             * @param {*} [transaction] optional, process in a transaction
             * @param {*|function} [transactionSuccess] optional, transaction success callback
             *  called with the exist result parameter
             * @param {*|function} [transactionError] optional，transaction error callback
             * @returns {*|promise} `promise` for none transaction, `undefined` for transaction
             */
            delete: function (tableName, conditionsObj, transaction, transactionSuccess, transactionError) {
                var sql;
                var sqlConditions;
                var conditionsValues;
                var condition;

                // 1.argument validation
                if (!tableName || !tableName.length
                    || !angular.isObject(conditionsObj)) {
                    throw new Error('invalid arguments');
                }

                // 2.build condition sql
                condition = _private.buildConditionSql(conditionsObj);
                sqlConditions = condition.sql;
                conditionsValues = condition.values;

                // 3.build complete sql
                sql = 'delete from ' + tableName + ' where ' + sqlConditions;

                // 4.execute sql
                if (transaction) {
                    return _private.transaction_executeSql(transaction, sql, conditionsValues,
                        transactionSuccess, transactionError);
                } else {
                    return _public.executeSql(sql, conditionsValues);
                }

            },

            /**
             * get a values array by a key-value pairs object and keys array
             * @param sourceObject {Object} the key-value pairs data source object
             * @param columns {Array} array of column name
             * @param {Array} [noRequireColumns=[]] optional, column names array which don't check require
             * @returns {Array} the values array
             * @throw {Error}
             */
            getColumnsValues: function (sourceObject, columns, noRequireColumns) {
                var values = [];

                noRequireColumns = noRequireColumns || [];
                columns.forEach(function (column) {
                    if (_private.checkObjPropHasValue(sourceObject, column)) {
                        values.push(sourceObject[column]);
                    } else if (noRequireColumns.indexOf(column) !== -1) {
                        values.push('');
                    } else {
                        throw new Error(column + 'was empty');
                    }
                });

                return values;
            },

            /**
             * decides whether exist a table
             * @param tableName {string} table name
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            existsTable: function (tableName, dbName) {
                return _public.exists('sqlite_master', {type: 'table', name: tableName}, dbName);
            },

            /**
             * decides whether exist a column in a table
             * @param tableName {string} table name
             * @param columnName {string} column name
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            existsColumn: function (tableName, columnName, dbName) {
                // `PRAGMA` do not support parameterizable
                return _public.query("PRAGMA table_info('" + tableName + "')", [], dbName)
                    .then(function (rows) {
                        if (rows) {
                            return rows.some(function (row) {
                                return row.name === columnName;
                            });
                        }
                        return false;
                    });
            },

            /**
             * clear opened instances
             */
            clearOpenedInstance: function () {
                _instance = {};
            },

            /**
             * delete database file
             * @param {string} [dbName] optional, use the value of config.getDefaultDBName() default
             * @returns {promise}
             */
            deleteDB: function (dbName) {
                var defer;

                return $q
                    .when(device.ready())
                    .then(function () {
                        return dbName || _private.getDefaultDBName();
                    })
                    .then(function (dbName) {
                        defer = $q.defer();

                        if (!dbName) {
                            $log.error('deleteDB：dbName is empty');
                            defer.reject('db name is empty');
                        } else {
                            if (_instance[dbName]) {
                                _instance[dbName] = null;
                                delete _instance[dbName];
                            }

                            _private.getDBProvider().deleteDatabase(dbName,
                                function () {
                                    defer.resolve();
                                },
                                function (error) {
                                    $log.error('deleteDB:', error);
                                    defer.reject(error && error.message || error);
                                }
                            );
                        }

                        return defer.promise;
                    });
            }
        };

        /**
         * return the public API
         */
        return _public;
    }

})();
