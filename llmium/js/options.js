const load_secrets_from_inputs = () =>{
    let secrets = {};
    document.querySelectorAll('.secret-input').forEach((input)=>{
        if (input.value){
            secrets[input.name] = input.value;
        }
    });
    return secrets;
}

const load_secrets_from_storage = () =>{
    document.querySelectorAll('.secret-input').forEach((input)=>{
        chrome.storage.sync.get(input.name, (result)=>{
            if (result[input.name]){
                input.value = result[input.name];
            }
        });
    });    
}

const click_save = () =>{
    let secrets = load_secrets_from_inputs();
    chrome.storage.sync.set(secrets, ()=>{
        console.log('saved');
    });
}

load_secrets_from_storage();

document.querySelector('#save-btn').addEventListener('click', click_save);