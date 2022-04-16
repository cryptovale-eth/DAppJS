// interactions with the ethereum blockchain
// works with metamask

var DAppJS = {};
DAppJS.web3loaded = false;

DAppJS.getChainName = function(chainId){
    let _chainNames = [];
    _chainNames[137] = "polygon";
    _chainNames[1] = "ethereum";
    _chainNames[3] = "ropsten";
    _chainNames[4] = "rinkeby";
    _chainNames[5] = "goerli";
    _chainNames[80001] = "mumbai";
    _chainNames[56] = "binance smartchain";
    _chainNames[137] = "polygon";

    try{
        let id = parseInt(chainId);
        return _chainNames[id];
    } catch(e){
        console.error(e);
        return undefined;
    }
}


DAppJS.loadWeb3 = async function (forceLoadWeb3) {
    if (window.ethereum) {
        // listen to changes
        // load the script if it is not loaded yet
        if ((typeof Web3 === "undefined") || forceLoadWeb3) {
            var web3Loader = document.createElement('script');
            web3Loader.onload = DAppJS.prepareConnection;
            // load latest version dynamically
            web3Loader.src = 'https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js?' + (new Date()).getTime();
            document.head.appendChild(web3Loader);
        } else {
            await DAppJS.prepareConnection();
        }
    } else {
        // handle no extension installed
        window.dispatchEvent(new Event('web3NotFound'));
    }
}

DAppJS.isConnected = function () {
    return window.web3.currentProvider.isConnected();
}

DAppJS.prepareConnection = async function () {
    DAppJS.web3loaded = true;
    ethereum.on('accountsChanged', function () { window.dispatchEvent(new Event('web3AccountsChanged')); DAppJS.connectWallet(); });
    ethereum.on('chainChanged', function () { window.dispatchEvent(new Event('web3ChainChanged')); DAppJS.connectWallet(); });
    ethereum.on('disconnect', function () { window.dispatchEvent(new Event('web3Disconnected')); });
    ethereum.on('connect', function () { window.dispatchEvent(new Event('web3Connected')); });
    ethereum.on('message', function (message) { window.dispatchEvent(new Event('web3Message', { 'detail': message })); });
    ['web3AccountsChanged', 'web3Disconnected'].forEach(ev => window.addEventListener(ev, function () {
        DAppJS.web3connected = false;
    }));
    //window.web3 = new Web3(window.ethereum);
    window.dispatchEvent(new Event('web3Loaded'));
}

DAppJS.subscribe = async function (contractAddress, eventName) {

}

DAppJS.connect = async function (forceLoadWeb3) {
    // not loaded at all
    if (!DAppJS.web3loaded) {
        await DAppJS.loadWeb3(forceLoadWeb3);
        window.addEventListener('web3Loaded', async function () {
            await DAppJS.connectWallet();
        });
    } else {
        await DAppJS.connectWallet();
    }
}

DAppJS.connectWallet = async function () {
    window.dispatchEvent(new Event('web3ConnectionPending'));
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        DAppJS.actualAccount = window.web3.utils.toChecksumAddress(accounts[0]);
        if (DAppJS.actualAccount) {
            var networkType = await web3.eth.net.getNetworkType();
            DAppJS.actualChain = networkType;
            DAppJS.chainId = window.web3.eth.currentProvider.chainId;
            DAppJS.actualChainName = DAppJS.getChainName(DAppJS.chainId);
            window.dispatchEvent(new Event('web3ConnectionReady')); 
            DAppJS.web3connected = true;
        } else {
            window.dispatchEvent(new Event('web3NotConnected'));
        }
    } catch (e) {
        DAppJS.handleErrors(e);
        return e;
    }
}

DAppJS.loadContract = function (contractAddress, ABI) {
    DAppJS.contract = DAppJS.contract || [];
    if (typeof(ABI) == "string"){
        ABI = DAppJS.standardABIs[ABI];   
    }
    try {
        DAppJS.contract[window.web3.utils.toChecksumAddress(contractAddress)] = new window.web3.eth.Contract(ABI, window.web3.utils.toChecksumAddress(contractAddress));
    } catch (e) {
        return { success: false, result: e, resultType: typeof (e) };
    }
    return DAppJS.contract[window.web3.utils.toChecksumAddress(contractAddress)];
}

DAppJS.loadTextFile = async function (URI) {
    var response = await window.fetch(URI, { cache: "no-store" });
    var responseText = await response.text();
    return responseText;
}

DAppJS.loadABI = function (_ABI) {
    // check if ABI passed is a string, then check if we have it
    var ABI = _ABI;
    if (typeof (_ABI) === "string") {
        if (typeof (DAppJS.standardABIs[_ABI.toUpperCase()]) == "undefined") {
            return { success: false, result: "You didn't pass a valid ABI", resultType: "string" };
        } else {
            ABI = DAppJS.standardABIs[_ABI.toUpperCase()];
        }
    }
    return ABI;
}

DAppJS.getTokenImageURLFromIPFS = async function (contractAddress, tokenId, ABI) {
    // always select a random IPFS gateway
    var IPFSGateways = [];
    IPFSGateways.push('https://ipfs.fleek.co/ipfs/');
    //IPFSGateways.push('https://gateway.pinata.cloud/ipfs/');
    IPFSGateways.push('https://cloudflare-ipfs.com/ipfs/');
    IPFSGateways.push('https://infura-ipfs.io/ipfs/');
    IPFSGateways.push('https://ipfs.1-2.dev/ipfs/');
    IPFSGateway = IPFSGateways[Math.floor(Math.random() * IPFSGateways.length)];

    var getTokenURI = await DAppJS.callContractFunction({ method: "tokenURI", parameters: '"' + tokenId + '"' }, contractAddress, ABI);
    // fetch the tokenURIMetadata
    var tokenURIMetadataResult = await fetch(IPFSGateway + (getTokenURI.result.replace('ipfs://', '')));
    var tokenURIMetadata = await tokenURIMetadataResult.json();
    return IPFSGateway + tokenURIMetadata.image.replace('ipfs://', '');
}

DAppJS.estimateContractFunctionGas = async function (callOptions, contractAddress, _ABI) {
    var ABI = DAppJS.loadABI(_ABI);
    var methodName = callOptions.method;
    var etherValue = callOptions.value || 0;
    var parameters = callOptions.parameters;
    contractAddress = window.web3.utils.toChecksumAddress(contractAddress);
    await DAppJS.loadContract(contractAddress, ABI);
    var functionBody = 'DAppJS.contract["' + contractAddress + '"].methods.' + methodName + '(' + parameters + ').estimateGas({value: ' + etherValue + ',from: "' + DAppJS.actualAccount + '"});';
    try {
        var callGas = await eval(functionBody);
    } catch (e) {
        DAppJS.handleErrors(e);
        return { success: false, result: e, resultType: typeof (e) };
    }
    var currentGasPrice = await window.web3.eth.getGasPrice();
    var result = { gas: callGas, gasPrice: currentGasPrice };
    return { success: true, result: result, resultType: typeof (result) };
}

DAppJS.sendEther = async function (to, amountInWei, data) {
    try {
        var call = await web3.eth.sendTransaction({ from: DAppJS.actualAccount, to: to, data: data, value: amountInWei });
        return { success: true, result: call, resultType: "undefined" };
    } catch (e) {
        DAppJS.handleErrors(e);
        return { success: false, result: e, resultType: typeof (e) };
    }
}

DAppJS.callContractFunction = async function (callOptions, contractAddress, _ABI, buffer, gasEstimationByProvider, gasEstimationFunction) {
    if (gasEstimationByProvider == undefined) {
        gasEstimationByProvider = DAppJS.gasEstimationByProvider;
    }
    if (gasEstimationFunction == undefined) {
        gasEstimationFunction = DAppJS.gasEstimationFunction;
    }
    if (gasEstimationFunction == undefined) {
        gasEstimationFunction = async function () { var result = (await DAppJS.estimateContractFunctionGas(callOptions, contractAddress, ABI)).result; return result; };
    }
    if (buffer == undefined) {
        buffer = DAppJS.gasBuffer;
    }
    if (buffer == undefined) {
        // add 20% buffer for gas calculation, in order to fund the transaction
        // this is only used if gasEstimationByProvider is false and no function is passed
        buffer = 0.2;
    }

    var ABI = DAppJS.loadABI(_ABI);
    var methodName = callOptions.method;
    var etherValue = callOptions.value || 0;
    var parameters = callOptions.parameters;
    contractAddress = window.web3.utils.toChecksumAddress(contractAddress);
    await DAppJS.loadContract(contractAddress, ABI);
    var gasLimitCall = (await DAppJS.estimateContractFunctionGas(callOptions, contractAddress, ABI));
    if (!gasLimitCall.success) {
        console.error('callContractFunction error:', gasLimitCall.result.message);
        return { success: false, result: gasLimitCall.result, resultType: typeof (gasLimitCall.result) };
    }
    var gasLimit = parseInt(gasLimitCall.result.gas * (1 + buffer));
    //var gasEstimation = await DAppJS.estimateContractFunctionGas(callOptions, contractAddress, ABI);
    var callString;
    callString = 'DAppJS.contract["' + contractAddress + '"].methods.' + methodName + '(' + parameters + ').call()';
    // check if the call changes state
    if (DAppJS.changesState(methodName, ABI)){
        if (gasEstimationByProvider) {
            // let the web3 provider estimate gas
            callString = 'DAppJS.contract["' + contractAddress + '"].methods.' + methodName + '(' + parameters + ').send({value: ' + etherValue + ',from: "' + DAppJS.actualAccount + '"  })';
        } else {
            var gas = await gasEstimationFunction();
            // old type of gas estimation
            if (gas.gas !== undefined) {
                console.log('Type 1 legacy transaction');
                callString = 'DAppJS.contract["' + contractAddress + '"].methods.' + methodName + '(' + parameters + ').send({value: ' + etherValue + ', gas:' + web3.utils.toBN((Math.round(gas.gas * (1 + buffer))).toString()) + ',gasPrice: ' + web3.utils.toBN(gas.gasPrice.toString()) + ', from: "' + DAppJS.actualAccount + '"  })';
            } else {
                console.log('Type 2 (EIP-1559) transaction');
                var maxFeePerGas = gas.maxFeePerGas;
                var maxPriorityFeePerGas = gas.maxPriorityFeePerGas;
                var baseFee = gas.baseFee;
                callString = 'DAppJS.contract["' + contractAddress + '"].methods.' + methodName + '(' + parameters + ').send({type:"0x2" ,value: ' + web3.utils.toBN(etherValue.toString()) + ',gasLimit:' + web3.utils.toBN(gasLimit.toString())+',maxFeePerGas:' + web3.utils.toBN(maxFeePerGas.toString()) + ',maxPriorityFeePerGas: ' + web3.utils.toBN(maxPriorityFeePerGas.toString()) + ',baseFee:' + baseFee + ', from: "' + DAppJS.actualAccount + '"  })';
            }
        }
    }
    try {
        // make the call
        var callContractFunctionResult = await eval(callString);
        // get the type of result from the ABI
        var methodCall = ABI.filter(el => el.name == methodName);
        var resultType = "undefined";
        if (methodCall.length > 0) {
            if (methodCall[0].outputs.length > 0) {
                resultType = methodCall[0].outputs[0].type || "undefined";
            }
        }
        return { success: true, result: callContractFunctionResult, resultType: resultType };
    } catch (e) {
        // if an error has occurred, return it
        DAppJS.handleErrors(e);
        return { success: false, result: e, resultType: typeof (e) };
    }
}

DAppJS.changesState = function (methodName, ABI) {
    return ["pure", "view"].indexOf(ABI.filter(c => c.name == methodName)[0].stateMutability.toLowerCase()) == -1;
}

DAppJS.handleErrors = function (e) {
    switch (e.code) {
        case -32000:
            window.dispatchEvent(new Event('notEnoughFunds', { 'detail': e }));
            break;
        case -32002:
            window.dispatchEvent(new Event('waitingForConnection', { 'detail': e }));
            break;
        case 4001:
            window.dispatchEvent(new Event('requestRejected', { 'detail': e }));
            break;
        case -32603:
            window.dispatchEvent(new Event('networkError', { 'detail': e }));
        default:
            window.dispatchEvent(new Event('DAppJS generic error', { 'detail': e }));
            console.error(e);
    }
}

DAppJS.fromTimestamp = function (timestamp) {
    return new Date(timestamp * 1000);
}

DAppJS.toTimestamp = function (date) {
    return Math.floor(date.getTime() / 1000);
}

DAppJS.addMethodToABI = function (originalABI, newABI) {
    if (typeof (newABI) == "string") {
        newABI = JSON.parse(newABI);
    }
    originalABI.push(newABI);
}

DAppJS.loadContractABIFromEtherscan = async function (contractAddress) {
    try {
        contractAddress = window.web3.utils.toChecksumAddress(contractAddress);
    } catch (e) {
        return { success: false, result: e, resultType: typeof (e) };
    }
    var result = await (
        window.fetch('https://api.etherscan.io/api?module=contract&action=getabi&address=' + contractAddress).then(
            result => result.json()
        )
    )
    return JSON.parse(result.result);
}

DAppJS.prefixed = function (hash) {
    return web3.utils.keccak256(web3.utils.encodePacked("\x19Ethereum Signed Message:\n32", hash));
}

DAppJS.pack = function (data) {
    return web3.utils.keccak256(web3.utils.encodePacked(data));
}

DAppJS.addSignatureCall = function () {
    DAppJS.signatureCalls = DAppJS.signatureCalls || [];
    DAppJS.signatureCalls[arguments[0]] = [];;
    for (var i = 1; i < arguments.length; i++) {
        DAppJS.signatureCalls[arguments[0]].push(arguments[i]);
    }
}

DAppJS.signedCallToSha3 = function () {
    var params = DAppJS.toSoliditySha3Parameters(arguments);
    return DAppJS.toSoliditySha3(params);
}


DAppJS.toSoliditySha3 = function (paramArray) {
    return web3.utils.soliditySha3.apply(null, paramArray);
}

DAppJS.toSoliditySha3Parameters = function () {
    if (!DAppJS.signatureCalls) {
        throw ("No signature calls defined");
    }
    if (typeof (arguments[0]) == "object") {
        args = arguments[0];
    } else {
        args = arguments;
    }
    var sObject = [];
    var index = 0;
    DAppJS.signatureCalls[args[0]].forEach(paramDefinition => {
        var singleObj = {};
        singleObj.t = paramDefinition;
        singleObj.v = args[1 + index];
        sObject.push(singleObj);
        index++;
    });
    return sObject;
}

DAppJS.signMessage = async function (signerAddress, parameters) {
    //recipient, avatarIndex, _message, nonce
    // get the parameters dynamically
    // {t: 'address', v: recipient}, {t: 'uint256', v:avatarIndex}, {t: 'string', v: _message}, {t: 'uint256', v: nonce}
    // bytes32 message = SignedMessages.prefixed(keccak256(abi.encodePacked(msg.sender, _tokenId, _setPrice, expirationTimestamp, _nonce)));
    if (parameters.trim() == '') {
        console.error('You need to pass a parameter string for the soliditySha3 function');
        return;
    }
    return await web3.eth.personal.sign(parameters, signerAddress);
}


DAppJS.signMessagePK = async function (parameters, privateKey) {
    //recipient, avatarIndex, _message, nonce
    // get the parameters dynamically
    // {t: 'address', v: recipient}, {t: 'uint256', v:avatarIndex}, {t: 'string', v: _message}, {t: 'uint256', v: nonce}
    // bytes32 message = SignedMessages.prefixed(keccak256(abi.encodePacked(msg.sender, _tokenId, _setPrice, expirationTimestamp, _nonce)));
    if (parameters.trim() == '') {
        console.error('You need to pass a parameter string');
        return;
    }
    return await web3.eth.accounts.sign(parameters, privateKey);
}


DAppJS.standardABIs = [];
DAppJS.standardABIs['ERC721'] = JSON.parse('[    {      "inputs": [        {          "internalType": "string",          "name": "name_",          "type": "string"        },        {          "internalType": "string",          "name": "symbol_",          "type": "string"        }      ],      "stateMutability": "nonpayable",      "type": "constructor"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "approved",          "type": "address"        },        {          "indexed": true,          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "Approval",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "indexed": false,          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "ApprovalForAll",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "from",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "to",          "type": "address"        },        {          "indexed": true,          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "Transfer",      "type": "event"    },    {      "inputs": [        {          "internalType": "bytes4",          "name": "interfaceId",          "type": "bytes4"        }      ],      "name": "supportsInterface",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "owner",          "type": "address"        }      ],      "name": "balanceOf",      "outputs": [        {          "internalType": "uint256",          "name": "",          "type": "uint256"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "ownerOf",      "outputs": [        {          "internalType": "address",          "name": "",          "type": "address"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [],      "name": "name",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [],      "name": "symbol",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "tokenURI",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "approve",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "getApproved",      "outputs": [        {          "internalType": "address",          "name": "",          "type": "address"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "setApprovalForAll",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "owner",          "type": "address"        },        {          "internalType": "address",          "name": "operator",          "type": "address"        }      ],      "name": "isApprovedForAll",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "transferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        }      ],      "name": "safeTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "tokenId",          "type": "uint256"        },        {          "internalType": "bytes",          "name": "_data",          "type": "bytes"        }      ],      "name": "safeTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    }  ]');
DAppJS.standardABIs['ERC1155'] = JSON.parse('[    {      "inputs": [        {          "internalType": "string",          "name": "uri_",          "type": "string"        }      ],      "stateMutability": "nonpayable",      "type": "constructor"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "account",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "indexed": false,          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "ApprovalForAll",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "from",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "to",          "type": "address"        },        {          "indexed": false,          "internalType": "uint256[]",          "name": "ids",          "type": "uint256[]"        },        {          "indexed": false,          "internalType": "uint256[]",          "name": "values",          "type": "uint256[]"        }      ],      "name": "TransferBatch",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": true,          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "from",          "type": "address"        },        {          "indexed": true,          "internalType": "address",          "name": "to",          "type": "address"        },        {          "indexed": false,          "internalType": "uint256",          "name": "id",          "type": "uint256"        },        {          "indexed": false,          "internalType": "uint256",          "name": "value",          "type": "uint256"        }      ],      "name": "TransferSingle",      "type": "event"    },    {      "anonymous": false,      "inputs": [        {          "indexed": false,          "internalType": "string",          "name": "value",          "type": "string"        },        {          "indexed": true,          "internalType": "uint256",          "name": "id",          "type": "uint256"        }      ],      "name": "URI",      "type": "event"    },    {      "inputs": [        {          "internalType": "bytes4",          "name": "interfaceId",          "type": "bytes4"        }      ],      "name": "supportsInterface",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "uint256",          "name": "",          "type": "uint256"        }      ],      "name": "uri",      "outputs": [        {          "internalType": "string",          "name": "",          "type": "string"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "account",          "type": "address"        },        {          "internalType": "uint256",          "name": "id",          "type": "uint256"        }      ],      "name": "balanceOf",      "outputs": [        {          "internalType": "uint256",          "name": "",          "type": "uint256"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address[]",          "name": "accounts",          "type": "address[]"        },        {          "internalType": "uint256[]",          "name": "ids",          "type": "uint256[]"        }      ],      "name": "balanceOfBatch",      "outputs": [        {          "internalType": "uint256[]",          "name": "",          "type": "uint256[]"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "operator",          "type": "address"        },        {          "internalType": "bool",          "name": "approved",          "type": "bool"        }      ],      "name": "setApprovalForAll",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "account",          "type": "address"        },        {          "internalType": "address",          "name": "operator",          "type": "address"        }      ],      "name": "isApprovedForAll",      "outputs": [        {          "internalType": "bool",          "name": "",          "type": "bool"        }      ],      "stateMutability": "view",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256",          "name": "id",          "type": "uint256"        },        {          "internalType": "uint256",          "name": "amount",          "type": "uint256"        },        {          "internalType": "bytes",          "name": "data",          "type": "bytes"        }      ],      "name": "safeTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    },    {      "inputs": [        {          "internalType": "address",          "name": "from",          "type": "address"        },        {          "internalType": "address",          "name": "to",          "type": "address"        },        {          "internalType": "uint256[]",          "name": "ids",          "type": "uint256[]"        },        {          "internalType": "uint256[]",          "name": "amounts",          "type": "uint256[]"        },        {          "internalType": "bytes",          "name": "data",          "type": "bytes"        }      ],      "name": "safeBatchTransferFrom",      "outputs": [],      "stateMutability": "nonpayable",      "type": "function"    }  ]');
