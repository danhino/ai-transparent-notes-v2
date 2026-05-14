use std::time::Duration;

#[tauri::command]
pub async fn call_ai(
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    content: String,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let full_prompt = if content.is_empty() {
        prompt
    } else {
        format!("{}\n\n{}", prompt, content)
    };

    match provider.as_str() {
        "claude" => {
            let body = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": full_prompt}]
            });
            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "Request timed out after 30 seconds.".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if response.status() == 401 {
                return Err("Invalid API key. Please check Settings.".to_string());
            }
            if response.status() == 429 {
                return Err("API quota exceeded or rate limited. Please wait and try again.".to_string());
            }
            if !response.status().is_success() {
                return Err(format!("API error: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["content"][0]["text"]
                .as_str()
                .ok_or("No response text from Claude")?
                .to_string();
            Ok(text)
        }
        "openai" => {
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": full_prompt}]
            });
            let response = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "Request timed out after 30 seconds.".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if response.status() == 401 {
                return Err("Invalid API key. Please check Settings.".to_string());
            }
            if response.status() == 429 {
                return Err("API quota exceeded or rate limited. Please wait and try again.".to_string());
            }
            if !response.status().is_success() {
                return Err(format!("API error: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("No response text from OpenAI")?
                .to_string();
            Ok(text)
        }
        _ => Err("Unknown provider".to_string()),
    }
}
