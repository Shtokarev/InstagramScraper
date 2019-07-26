const {
  Worker,
  isMainThread,
  parentPort,
  workerData
} = require('worker_threads');

// type WorkerCallback = (err: any, result?: any) => any;

function runWorker(
  // path: string,
  // cb: WorkerCallback,
  // workerData: object | null = null
  path,
  cb,
  workerData = null
) {
  const worker = new Worker(path, { workerData });

  worker.on('message', data => {
    if (data.tic) {
      console.log(`recive tic from worker ${data.tic}`);
    } else {
      console.log(data);
    }
    // cb.bind(null, null);
    // cb(null, data);
  });

  worker.on('error', error => {
    console.log(error);
    // cb(error);
  });

  worker.on('exit', exitCode => {
    if (exitCode === 0) {
      return null;
    }

    return cb(new Error(`Worker has stopped with code ${exitCode}`));
  });

  return worker;
}

module.exports = runWorker;
