import { showToast } from './toast.js';

let recognition = null;
let isListening = false;
let targetTextarea = null;

export function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('[Voice] Speech recognition not supported');
    return;
  }

  document.querySelectorAll('.mic-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textareaId = btn.dataset.target;
      const textarea = document.getElementById(textareaId);
      if (textarea) {
        toggleListening(textarea);
      }
    });
  });
}

function toggleListening(textarea) {
  if (isListening) {
    stopListening();
  } else {
    startListening(textarea);
  }
}

function startListening(textarea) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Speech recognition not supported', 'error');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  targetTextarea = textarea;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        targetTextarea.value = targetTextarea.value + transcript + ' ';
        targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        interim = transcript;
      }
    }

    let indicator = document.querySelector('.voice-indicator');
    if (interim && indicator) {
      indicator.textContent = interim;
    }
  };

  recognition.onerror = (event) => {
    console.error('[Voice] Error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone access denied', 'error');
    } else if (event.error !== 'aborted') {
      showToast(`Voice error: ${event.error}`, 'error');
    }
    stopListening();
  };

  recognition.onend = () => {
    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        stopListening();
      }
    }
  };

  try {
    recognition.start();
    isListening = true;

    document.querySelectorAll('.mic-btn').forEach(b => b.classList.add('recording'));

    let indicator = document.querySelector('.voice-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'voice-indicator';
      document.body.appendChild(indicator);
    }
    indicator.textContent = 'Listening...';
    indicator.classList.add('visible');

    const rect = targetTextarea.getBoundingClientRect();
    indicator.style.left = `${rect.left}px`;
    indicator.style.top = `${rect.top - 32}px`;
  } catch (e) {
    showToast('Failed to start voice input', 'error');
  }
}

function stopListening() {
  isListening = false;

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
    recognition = null;
  }

  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));

  const indicator = document.querySelector('.voice-indicator');
  if (indicator) {
    indicator.classList.remove('visible');
  }
}

export function toggleVoiceInput() {
  const activeTextarea = document.activeElement?.tagName === 'TEXTAREA'
    ? document.activeElement
    : document.getElementById('homeInput');

  if (activeTextarea) {
    toggleListening(activeTextarea);
  }
}
