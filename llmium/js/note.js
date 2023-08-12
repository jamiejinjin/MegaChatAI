/*
This is how to fetch an image from the OpenAI API
in the command line:

curl https://api.openai.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "prompt": "a white siamese cat",
    "n": 1,
    "size": "1024x1024"
  }'
*/

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

const fetch_image = async (promt) => {
    let token = await load_secrets_from_storage('OPENAI_API_KEY')
    let url = "https://api.openai.com/v1/images/generations";
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            "prompt": promt,
            "n": 1,
            "size": "512x512"
        })
    });
    const json = await response.json();
    console.log(json)
    const image_url = json.data[0].url
    return image_url;
}


// Click button and send prompt
const send_prompt_and_visualize = async () => {
    let prompt0 = document.querySelector("#note-input-text").value;
    let prompt = "Please generate a realistic photo includs these following description: " + prompt0;

    if (prompt == "") {
        alert("Please enter a prompt");
        return;
    }

    let image_url = await fetch_image(prompt);

    let image = document.createElement("img");
    image.src = image_url;

    let image_container = document.querySelector("#generated-image");

    image_container.innerHTML = "";

    image_container.appendChild(image);

}

document.querySelector("#imagine").addEventListener("click", send_prompt_and_visualize);

