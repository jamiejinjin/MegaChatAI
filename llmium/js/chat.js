const load_secrets_from_storage = async (name) => {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(name, (result) => {
            if (result[name]) {
                resolve(result[name]);
            } else {
                reject();
            }
        });
    });
}

const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';

// Create a TextDecoder to decode the response body stream
const decoder = new TextDecoder();

let controller = new AbortController();

document.querySelector("#stop-generation").addEventListener("click", () => {
    controller.abort();   
    controller = new AbortController();
});

class OpenAIChat {
    constructor(params) {
        this.initialize();
        this.params = this.prepare_params(params);
        this.api_url = OPENAI_CHAT_API_URL;
    }

    prepare_params(params) {
        let { temperature, max_tokens, model } = params;
        if (!temperature) {
            temperature = 0.;
        }
        if (!max_tokens) {
            max_tokens = 512;
        }
        if (!model) {
            model = 'gpt-3.5-turbo-16k';
        }
        let new_params = {
            temperature, max_tokens, model
        }

        return new_params;
    }

    async initialize() {
        try {
            this.token = await load_secrets_from_storage('OPENAI_API_KEY');
            if (this.token == undefined){
                console.error("Token not defined")
            }
            console.debug('OPENAI_API_KEY token loaded');
        } catch (e) {
            console.error('OPENAI_API_KEY token not found');
            console.error("please setup your OPENAI_API_KEY in the options page");
            console.error(e);
        }
    }

    pack_string_message(message) {
        return [
            { "content": message, "role": "user" },
        ];
    }

    async send_messages(conversation) {
        let body = JSON.stringify({
            messages: conversation,
            ...this.params,
        })

        console.log(body);

        let response = await fetch(this.api_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: body
        });
        let json = await response.json();
        if (json.error) {
            console.error(json);
            return null;
        }
        return json;
    }

    async send_messages_stream(conversation, callback) {
        let payload = JSON.stringify({
            messages: conversation,
            stream: true,
            ...this.params,
        })

        const response = await fetch(this.api_url, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: payload,
            signal: controller.signal,
        });

        if (response.status === 404) {
            alert("404 - Your token doesn't have the access to the model");
        }

        // loop through the response body stream
        const reader = response.body.getReader();
        while (true) {
            let { done, value } = await reader.read();
            // data: [DONE] means that the stream has finished
            if (done) break;

            // decode the stream into a string
            let chunk = decoder.decode(value);

            let json_array = chunk
                .split('\n')
                .map((line) => line.replace("data: ", ""))
                .filter((line) => line.length > 0)
                .filter((line) => line != "[DONE]")
                .map((line) => JSON.parse(line))

            // console.log(chunk);
            // console.log(JSON.parse(chunk));
            callback(json_array);
        }
    }

    async send_message(message) {
        let conversation = this.pack_string_message(message);
        let response = await this.send_messages(conversation);
        return response.choices[0].message.content;
    }
}

const append_new_message = (role, message) => {
    // Append the content to the conversation area
    let conversation_box = document.querySelector('#conversation');
    let new_message = document.createElement('div');
    // Give every message class including "message" and role
    new_message.classList.add('message');
    new_message.classList.add(`message-${role}`);
    new_message.innerText = message;
    conversation_box.appendChild(new_message);
}


const collect_messages = () => {
    /*
    Collect all messages in the conversation box
    */
   let messages = [];
    let prompt_text = document.querySelector('#prompt').value;
    if(prompt_text !==''){
        // If there's an prompt, give this array system&content first
        let role = "system";
        let content = prompt_text;
        messages.push({role,content});
    }

    document.querySelectorAll('.message').forEach((message_box) => {
        // Select each message's role and content
        let role = message_box.classList[1].split('-')[1];
        let content = message_box.innerText.trim();
      // Push role and content into the array "message"
        messages.push({ role, content });
     });
     return messages;  
}


let model = "gpt-3.5-turbo-16k";    
let chat = new OpenAIChat({ model });

const click_send = async () => {
    let input_text = document.querySelector('#chat-input-text').value;
    if (input_text == '') {
        alert('Please enter your question')
        return;
    } else {
         // Stop generation button after sending
        let stopG = document.getElementById('stop-generation');
        if (stopG.hasAttribute("hidden")){
                stopG.removeAttribute("hidden")
            };  

        // Print the result on conversation area
        append_new_message('user', "Me: "+input_text);
        // Clear the input box after sending
        document.querySelector('#chat-input-text').value = '';
        
        let messages = collect_messages();
        console.log(messages)

            chat.send_messages_stream(messages, (answer_list) => {
                answer_list.forEach((answer) => {
                    const { delta } = answer.choices[0];
                    
                let new_message_box = document.querySelector(`#message-${answer.id}`);
                if (!new_message_box) {
                    let new_meassage_head = document.createElement('div');
                    new_meassage_head.innerText = '🌟 AI Assistant:';
                    document.querySelector('#conversation').appendChild(new_meassage_head)
                    new_message_box = document.createElement('div');
                    new_message_box.classList.add('message');
                    new_message_box.classList.add(`message-assistant`);
                    new_message_box.id = `message-${answer.id}`;
                    document.querySelector('#conversation').appendChild(new_message_box);
                }
                let { content } = delta;
                if (content != undefined){
                    let span = document.createElement('span');
                    content = content.replace('\n', '<br>')
                    span.innerHTML = content;
                    new_message_box.appendChild(span);

                    // Change the text color effect
                    function changeTextColor(element,colorClass,seconds){
                        setTimeout(()=>{
                            element.className=colorClass;
                        },seconds*1000)
                    };

                    changeTextColor(span, 'orange' ,0.);
                    changeTextColor(span, 'red', 0.2);
                    changeTextColor(span, 'yellow' ,0.4);
                    changeTextColor(span, 'almostwhite' ,0.6);
                    changeTextColor(span, 'white' , 1.0);
                }
            });
        }
        );   
    }    
}


document.querySelector('#send-btn').addEventListener('click', click_send);


// Press Enter to send message
    const sendBtn = document.getElementById("send-btn");
    const messageInsert = document.getElementById("chat-input");
    messageInsert.addEventListener("keyup",function(event){
        if (event.key === "Enter"){
            sendBtn.click();
        }
    });

// Dropdown to select the model
let modelDescription = {
    "gpt-3.5-turbo":"Most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.Most tokens - 4096",
    "gpt-3.5-turbo-16k":"Same capabilities as the standard gpt-3.5-turbo model but with 4 times the context.Most tokens - 16384",
    "gpt-4":"More capable than any GPT-3.5 model, able to do more complex tasks, and optimized for chat.",
    "gpt-4-32k":"Same capabilities as the base gpt-4 mode but with 4x the context length."
};
let modelOptions = document.getElementById("model-select-dropdown");
modelOptions.addEventListener("change",function(){
    chat.params.model = modelOptions.value;
    // console.debug(chat.params.model)
    document.getElementById("description-title").innerText = modelOptions.value;
    document.getElementById("description-text").innerText = modelDescription[modelOptions.value];
});


// Prompt button to fold&unfold the prompt input
let foldbtn = document.getElementById('prompt-btn');
let foldableInput = document.querySelector('.foldable');

foldbtn.addEventListener('click',function(){
    foldableInput.classList.toggle('expanded');
    foldbtn.style.display = "none"
});

