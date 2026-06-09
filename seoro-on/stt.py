import modal
import os

try:
    from fastapi import Request
except ImportError:
    pass

# 이미지 빌드 중 모델 캐싱용 함수 (GPU 없이 CPU에서 다운로드만)
def download_whisper_model():
    import whisper
    whisper.load_model("turbo")
    print("[build] turbo 모델 캐싱 완료")

image = (
    modal.Image.debian_slim()
    .pip_install("openai-whisper", "torch", "fastapi[standard]", "tiktoken")
    .apt_install("ffmpeg")
    .run_function(download_whisper_model)  # 배포 시 모델을 이미지에 구워둠
)

app = modal.App("seoro-on-stt", image=image)

INITIAL_PROMPT = (
    "어르신이 자신의 이야기를 구술하는 녹음입니다. "
    "가족, 고향, 부모님, 형제, 자녀, 손자, 손녀, 남편, 아내, 친구, "
    "어린 시절, 학교, 결혼, 직장, 농사, 시장, 고생, 추억, "
    "그때, 그러니까, 있잖아요, 아무튼, 그래서, 그런데, 근데, "
    "옛날에는, 그 시절에는, 생각해보면, 지금도 기억나는데."
)


@app.cls(gpu="T4")
class WhisperSTT:
    @modal.enter()
    def load_model(self):
        import whisper
        print("[STT] turbo 모델 로드 중 (캐시에서)...")
        self.model = whisper.load_model("turbo")
        print("[STT] turbo 모델 로드 완료")

    @modal.method()
    def transcribe(self, audio_bytes: bytes) -> dict:
        import tempfile
        print(f"[STT] 오디오 수신: {len(audio_bytes)} bytes")

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False, dir="/tmp") as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            try:
                result = self.model.transcribe(
                    temp_path,
                    language="ko",
                    initial_prompt=INITIAL_PROMPT,
                    word_timestamps=True,
                )
                words = []
                for segment in result.get("segments", []):
                    for w in segment.get("words", []):
                        words.append({
                            "word": w["word"].strip(),
                            "start": round(w["start"], 3),
                            "end": round(w["end"], 3),
                        })
                print(f"[STT] 완료 (word_timestamps): {result['text'][:80]}")
                return {"text": result["text"], "words": words}
            except Exception as e1:
                print(f"[STT] word_timestamps 실패, 재시도: {e1}")
                result = self.model.transcribe(
                    temp_path,
                    language="ko",
                    initial_prompt=INITIAL_PROMPT,
                )
                print(f"[STT] 완료 (기본): {result['text'][:80]}")
                return {"text": result["text"], "words": []}
        except Exception as e:
            print(f"[STT] 오류: {e}")
            return {"text": "", "words": [], "error": str(e)}
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.function()
@modal.fastapi_endpoint(method="POST")
async def api_stt(request: "Request"):
    try:
        body = await request.body()
        print(f"[api_stt] 요청: {len(body)} bytes")
        if not body:
            return {"error": "음성 데이터 없음", "text": "", "words": []}
        stt = WhisperSTT()
        result = stt.transcribe.remote(body)
        return {
            "text": result.get("text", "").strip(),
            "words": result.get("words", []),
        }
    except Exception as e:
        print(f"[api_stt] 오류: {e}")
        return {"error": str(e), "text": "", "words": []}
