// interactions with the ethereum blockchain
// works with metamask

var DAppJS = {};
DAppJS.web3loaded = false;

DAppJS.loadWeb3 = function(trigger){
	if (window.ethereum) {
		// listen to changes
        // load the script if it is not loaded yet
        if (typeof Web3 === "undefined"){
            var web3Loader = document.createElement('script');
            web3Loader.onload = continueLoading;
            // load latest version dynamically
            web3Loader.src = 'https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js';
            document.head.appendChild(web3Loader);
        } else {
            continueLoading();
        }
        DAppJS.web3loaded = true;
        function continueLoading(){
            ethereum.on('accountsChanged', function(){window.dispatchEvent(new Event('accountsChanged'));});
            ethereum.on('chainChanged', function(){window.dispatchEvent(new Event('chainChanged'));});
            ethereum.on('disconnect', function(){window.dispatchEvent(new Event('disconnect'));});
            window.web3 = new Web3(window.ethereum);
            web3.eth.getAccounts().then(function(accounts){
                DAppJS.actualAccount = accounts[0];
                if (DAppJS.actualAccount){
                    web3.eth.net.getNetworkType().then(function(networkType){
                        DAppJS.actualChain = networkType;
                        window.dispatchEvent(new Event('web3Connected'));
                    });
                } else {
                    window.dispatchEvent(new Event('web3NotConnected'));
                }
            });
        }
    } else {
        // handle no extension installed
        window.dispatchEvent(new Event('noWeb3found'));
    }
}

DAppJS.connect = function(){
    if (!DAppJS.web3loaded){
        DAppJS.loadWeb3();
        window.addEventListener('web3Connected', DAppJS.connect);
    } else { 
        window.ethereum.enable();
    }
}

DAppJS.loadContract = function(address, ABI){
	return new window.web3.eth.Contract(ABI, contractAddress);
}

DAppJS.loadTextFile = async function(URI){
    var response = await window.fetch(URI);
    var responseText = await response.text();
    return responseText;
}

DAppJS.callContractFunction = async function(callOptions, contractAddress, ABI){
    var methodName = callOptions.method;
    var etherValue = callOptions.value;
    var parameters = callOptions.parameters;
    
    var contract = DAppJS.loadContract(address, ABI);
    var callGasPrice = await this.contract.methods.adopt(adoptNum).estimateGas({
        value: etherValue,
        from: DAppJS.actualAccount
    });
    var currentGasPrice = await this.web3.eth.getGasPrice();
    // add 10% buffer
    var transactionData = {
        gas: parseInt(1.10 * callGasPrice),
        gasPrice: parseInt(1.10 * currentGasPrice),
        from: DAppJS.actualAccount,
        value: etherValue
    };
    var callString; 
    callString = 'await contract.method.'+methodName+'('+parameters+').call()';
    if (etherValue){
        callString = 'await contract.method.'+methodName+'('+parameters+').send('+JSON.stringify(transactionData)+')';
    }
    
    eval(callString);
}

DAppJS.signPass = async function(signer, parameters){
    //recipient, avatarIndex, _message, nonce
    // get the parameters dynamically
    // {t: 'address', v: recipient}, {t: 'uint256', v:avatarIndex}, {t: 'string', v: _message}, {t: 'uint256', v: nonce}
    if (parameters.trim()==''){
        console.error('You need to pass a parameter string for the soliditySha3 function');
        return;
    }
    var hash = web3.utils.soliditySha3(parameters).toString("hex");
    return await web3.eth.sign(hash, signer);
}
