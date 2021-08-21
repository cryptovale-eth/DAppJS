// interactions with the ethereum blockchain
// works with metamask

var DAppJS = {};

DAppJS.loadWeb3 = function(trigger) {
	if (window.ethereum) {
		// listen to changes
        // load the script if it is not loaded yet
        if (typeof Web3 === "undefined"){
            var web3Loader = document.createElement('script');
            web3Loader.onload = continueLoading;
            web3Loader.src = 'https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js';
            document.head.appendChild(web3Loader);
        } else {
            continueLoading();
        }
        function continueLoading(){
            ethereum.on('accountsChanged', function(){window.dispatchEvent(new Event('accountsChanged'));});
            ethereum.on('chainChanged', function(){window.dispatchEvent(new Event('chainChanged'));});
            ethereum.on('disconnect', function(){window.dispatchEvent(new Event('disconnect'));});
            window.web3 = new Web3(window.ethereum);
            web3.eth.getAccounts().then(function(accounts){
                window.actualAccount = accounts[0];
                if (window.actualAccount){
                    web3.eth.net.getNetworkType().then(function(networkType){
                        window.actualChain = networkType;
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
    window.ethereum.enable();
}

DAppJS.loadContract = function(address, ABI){
	return new window.web3.eth.Contract(ABI, contractAddress);
}

DAppJS.loadTextFile = async function(URI){
    var response = await window.fetch(URI);
    var responseText = await response.text();
    return responseText;
}

DAppJS.signMessage = async function(signer, recipient, avatarIndex, _message, nonce){
    var hash = web3.utils.soliditySha3(
    {t: 'address', v: recipient}, {t: 'uint256', v:avatarIndex}, {t: 'string', v: _message}, {t: 'uint256', v: nonce}
    ).toString("hex");
    console.log(hash);
    return await web3.eth.sign(hash, signer);
}
