const { workerData, parentPort } = require('worker_threads');

parentPort.postMessage({ hello: `${workerData.idWorker} started` });
console.log(`Process worker ${workerData.idWorker} started`);

const tempFunction = i => {
  console.log(`Worker ${workerData.idWorker} process ` + i);
  parentPort.postMessage({ tic: i });
  if (i < 3) {
    setTimeout(() => tempFunction(i + 1), 1000);
  } else {
    parentPort.close();
  }
};

parentPort.on('message', messageData => {
  // console.log(messageData);
  // const numberOfElements = 100;
  // const sharedBuffer = new SharedArrayBuffer(
  //   Int32Array.BYTES_PER_ELEMENT * numberOfElements
  // );
  // const arr = new Int32Array(sharedBuffer);

  // for (let i = 0; i < numberOfElements; i += 1) {
  //   arr[i] = Math.round(Math.random() * 30);
  // }
  // c;
  tempFunction(1);
  // parentPort.postMessage({ arr });
});

// setTimeout(() => {
//   console.log(`Process worker ${workerData.idWorker} terminated`);
//   parentPort.close();
// }, 5000);
