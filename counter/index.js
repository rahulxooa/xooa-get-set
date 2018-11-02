/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

"use strict";
const shim = require("fabric-shim");

const ClientIdentity = require("fabric-shim").ClientIdentity;

const Stub = require("fabric-shim").Stub;

async function allowAppAccess(stub) {
  let cid = new ClientIdentity(stub); // "stub" is the ChaincodeStub object passed to Init() and Invoke() methods
  let [AppId, Version] = process.env.CORE_CHAINCODE_ID_NAME.split(":");
  if (!cid.assertAttributeValue("AppId", AppId)) {
    throw new Error("Unauthorized");
  }
}

async function allowAccountAccess(stub) {
  let cid = new ClientIdentity(stub); // "stub" is the ChaincodeStub object passed to Init() and Invoke() methods

  if (!cid.assertAttributeValue("ChannelId", stub.getChannelID())) {
    throw new Error("Unauthorized");
  }
}

let Chaincode = class {
  // The Init method is called when the Smart Contract 'fabcar' is instantiated by the blockchain network
  // Best practice is to have any Ledger initialization in separate function -- see initLedger()
  async Init(stub) {
    console.info("=========== Instantiated fabcar chaincode ===========");
    return shim.success();
  }

  // The Invoke method is called as a result of an application request to run the Smart Contract
  // 'fabcar'. The calling application program has also specified the particular smart contract
  // function to be called, with arguments
  async Invoke(stub) {
    let ret = stub.getFunctionAndParameters();
    let method = this[ret.fcn];
    try {
      if (!method) {
        console.error("no function of name:" + ret.fcn + " found");
        throw new Error("Received unknown function " + ret.fcn + " invocation");
      }
    } catch (err) {
      console.log(err);
      let shimError = shim.error(err);
      shimError.status = 404;
      shimError.message = err.message;
      console.log(shimError);
      return shimError;
    }

    try {
      //check account level access
      await allowAccountAccess(stub);
      //check  app level access
      await allowAppAccess(stub);

      let payload = await method(stub, ret.params);
      return shim.success(payload);
    } catch (err) {
      console.log(err);
      let shimError = shim.error(err);
      shimError.status = Stub.RESPONSE_CODE.ERRORTHRESHOLD;

      shimError.message = err.message;
      return shimError;
    }
  }

  async get(stub, args) {
    if (args.length != 1) {
      throw new Error(
        "Incorrect number of arguments. Expecting CarNumber ex: CAR01"
      );
    }
    let carNumber = args[0];

    let carAsBytes = await stub.getState(carNumber); //get the car from chaincode state
    if (!carAsBytes || carAsBytes.toString().length <= 0) {
      throw new Error(carNumber + " does not exist: ");
    }
    console.log(carAsBytes.toString());
    return carAsBytes;
  }

  async decrement(stub, args) {
    console.info("============= START : Create Car ===========");
    if (args.length != 1) {
      throw new Error("Incorrect number of arguments. Expecting 5");
    }
    let counterValue = 0;
    let carAsBytes = await stub.getState(args[0]); //get the car from chaincode state
    if (carAsBytes) {
      counterValue = parseInt(carAsBytes.toString());
    }

    if (!counterValue) {
      counterValue = 0;
    } else {
      counterValue = counterValue - 1;
    }
    stub.setEvent("putstate", Buffer.from(String(counterValue)));
    await stub.putState(args[0], Buffer.from(String(counterValue)));
    console.info("============= END : Create Car ===========");
  }

  async increment(stub, args) {
    console.info("============= START : Create Car ===========");
    if (args.length != 1) {
      throw new Error("Incorrect number of arguments. Expecting 5");
    }

    let counterValue = 0;
    let carAsBytes = await stub.getState(args[0]); //get the car from chaincode state
    if (carAsBytes) {
      counterValue = parseInt(carAsBytes.toString());
    }
    if (!counterValue) {
      counterValue = 1;
    } else {
      counterValue = counterValue + 1;
    }
    stub.setEvent("putstate", Buffer.from(String(counterValue)));
    await stub.putState(args[0], Buffer.from(String(counterValue)));
    console.info("============= END : Create Car ===========");
  }
};

shim.start(new Chaincode());
