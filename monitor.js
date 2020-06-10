/*global module, require*/

/**
 * Class for metrics
 */
var Monitor = function () {

  this.results = {
    connection    : 0,
    disconnection : 0,
    errors        : 0,
    receiveMsg    : 0,
    heartbeat     : 0,
  };

  this.messageCounter = 0;

  this.counter = 0;
};


Monitor.prototype.connection = function () {
  this.results.connection++;
  this.counter++;
};

Monitor.prototype.disconnection = function () {
  this.results.disconnection++;
  this.counter++;
};

Monitor.prototype.errors = function () {
  this.results.errors++;
  this.counter++;
};

Monitor.prototype.receiveMsg = function () {
  this.results.receiveMsg++;
  this.messageCounter++;
};

Monitor.prototype.heartbeat = function () {
  this.results.heartbeat++;
  this.messageCounter++;
};


/**
 * Merge metrics
 */
Monitor.prototype.merge = function (monitor) {
  this.results.connection += monitor.results.connection;
  this.results.disconnection += monitor.results.disconnection;
  this.results.errors += monitor.results.errors;
  this.counter += monitor.counter;
  this.messageCounter += monitor.messageCounter;
  this.results.receiveMsg += monitor.results.receiveMsg;
};

module.exports = Monitor;
