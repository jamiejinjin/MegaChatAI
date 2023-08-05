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

const controller = new AbortController();

document.querySelector("#stop-generation").addEventListener("click", () => {
    controller.abort();
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
                .map((line) => JSON.parse(line));

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
    let conversation_box = document.querySelector('#conversation');
    let new_message = document.createElement('div');
    new_message.classList.add('message');
    new_message.classList.add(`message-${role}`);
    new_message.innerText = message;
    conversation_box.appendChild(new_message);
}

let model = "gpt-3.5-turbo-16k";

const chat = new OpenAIChat({ model });


const collect_messages = () => {
    /*
    Collect all messages in the conversation box
    */
    let messages = [];
    document.querySelectorAll('.message').forEach((message_box) => {
        let role = message_box.classList[1].split('-')[1];
        let content = message_box.innerText.trim();
        messages.push({ role, content });
    });
    return messages;
}


const click_send = async () => {
    let input_text = document.querySelector('#chat-input-text').value;
    if (input_text == '') {
        console.warn('empty input');
        return;
    } else {
        append_new_message('user', "Me: "+input_text);
        document.querySelector('#chat-input-text').value = '';
        let messages = collect_messages();
        messages.push(
            { "content": input_text, "role": "user" }
        )
        chat.send_messages_stream(messages, (answer_list) => {
            answer_list.forEach((answer) => {
                const { delta } = answer.choices[0];

                let new_message_box = document.querySelector(`#message-${answer.id}`);
                if (!new_message_box) {
                    new_message_box = document.createElement('div');
                    new_message_box.classList.add('message');
                    new_message_box.classList.add(`message-assistant`);
                    new_message_box.id = `message-${answer.id}`;
                    document.querySelector('#conversation').appendChild(new_message_box);
                }
                const { content } = delta;
                new_message_box.innerText += content;
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
