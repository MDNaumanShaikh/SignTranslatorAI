/**
 * coach.js
 * ─────────
 * AI Sign Coach - Interactive chatbot for learning ASL signs with real-time practice feedback
 */

'use strict';

// ─── Coach State ────────────────────────────────────────────────────────
const coachState = {
  practiceMode: false,
  currentSign: null,
  practiceCamera: null,
  practiceHands: null,
  recognitionHistory: [],
  feedbackTimer: null,
  lastFeedback: null,
  perfectFreezeUntil: 0, // Timestamp to freeze perfect status
  lastMotion: null // Store last motion pattern for analysis
};

// ─── Sign Knowledge Base ─────────────────────────────────────────────────
const signKnowledgeBase = {
  // Common signs from your trained model
  'THANK YOU': {
    category: 'manners',
    instructions: [
      "Start with fingers touching your chin",
      "Palm should face your body",
      "Move your hand forward and down in an arc",
      "End with palm facing upward and forward",
      "Keep fingers together and slightly curved"
    ],
    tips: [
      "This sign shows gratitude and appreciation",
      "The forward motion represents giving thanks",
      "Use a sincere facial expression to convey meaning"
    ],
    commonMistakes: [
      "Don't start too high on your face - chin level is correct",
      "Avoid keeping your palm facing down during the motion",
      "The motion should be smooth, not abrupt"
    ]
  },
  'CONFUSED': {
    category: 'emotions',
    instructions: [
      "Make a fist with your dominant hand",
      "Place your index finger on your forehead",
      "Scratch your forehead with a confused expression",
      "Move your finger in a small circular motion",
      "Keep your eyebrows furrowed to show confusion"
    ],
    tips: [
      "This sign represents mental confusion or uncertainty",
      "The scratching motion mimics thinking hard",
      "Combine with a questioning facial expression"
    ],
    commonMistakes: [
      "Don't press too hard on your forehead",
      "Keep the motion small and controlled",
      "Make sure your facial expression matches the sign"
    ]
  },
  'EYES AWAKE': {
    category: 'body',
    instructions: [
      "Point both index fingers to your eyes",
      "Keep other fingers curled down",
      "Quickly move both hands upward and outward",
      "Open your eyes wide as you sign",
      "The motion should be quick and decisive"
    ],
    tips: [
      "This sign indicates being awake or alert",
      "The upward motion represents eyes opening",
      "Can be used to say 'I'm awake' or 'wake up'"
    ],
    commonMistakes: [
      "Don't move your hands too slowly",
      "Keep your index fingers pointing to your eyes initially",
      "The motion should be upward, not sideways"
    ]
  },
  'FRIEND': {
    category: 'social',
    instructions: [
      "Hook both index fingers together",
      "Keep other fingers curled down",
      "Pull your hands apart slightly",
      "The motion represents a connection",
      "Maintain a friendly expression"
    ],
    tips: [
      "This sign shows friendship or connection",
      "The hooked fingers represent linking",
      "Can be modified for different levels of friendship"
    ],
    commonMistakes: [
      "Don't just touch fingers - hook them properly",
      "Keep the motion controlled, not jerky",
      "Both hands should move symmetrically"
    ]
  },
  'PRETTY': {
    category: 'descriptions',
    instructions: [
      "Place your thumb on your chin",
      "Extend your other fingers upward",
      "Move your hand down across your cheek",
      "End with fingers pointing forward",
      "Keep a pleasant, appreciative expression"
    ],
    tips: [
      "This sign describes beauty or attractiveness",
      "The downward motion strokes the face",
      "Can be used for people, objects, or scenes"
    ],
    commonMistakes: [
      "Don't press too hard on your chin",
      "Keep your fingers extended, not curled",
      "The motion should be smooth and graceful"
    ]
  },
  'RELAX': {
    category: 'actions',
    instructions: [
      "Make fists with both hands",
      "Place fists on your chest",
      "Let your hands drop down slowly",
      "Open your hands as they fall",
      "Take a deep breath as you sign"
    ],
    tips: [
      "This sign represents letting go of tension",
      "The falling motion shows release",
      "Combine with a calm facial expression"
    ],
    commonMistakes: [
      "Don't drop your hands too abruptly",
      "Keep the motion smooth and controlled",
      "Make sure to open your hands as they fall"
    ]
  },
  'REMEMBER': {
    category: 'mental',
    instructions: [
      "Make a fist with your dominant hand",
      "Place your fist on your forehead",
      "Pull your hand away slightly",
      "The motion represents pulling a memory",
      "Keep a thoughtful expression"
    ],
    tips: [
      "This sign indicates recalling information",
      "The pulling motion represents memory retrieval",
      "Can be repeated for emphasis"
    ],
    commonMistakes: [
      "Don't press too hard on your forehead",
      "The pulling motion should be small",
      "Keep your other hand relaxed at your side"
    ]
  },
  'NOTHING': {
    category: 'negation',
    instructions: [
      "Make a fist with both hands",
      "Keep thumbs extended upward",
      "Move both hands outward and apart",
      "The motion shows emptiness",
      "Shake your head slightly for emphasis"
    ],
    tips: [
      "This sign indicates absence or zero",
      "The outward motion represents emptiness",
      "Can be used to say 'I have nothing'"
    ],
    commonMistakes: [
      "Don't move your hands too far apart",
      "Keep your thumbs extended, not tucked",
      "The motion should be smooth, not jerky"
    ]
  },
  'NECK': {
    category: 'body',
    instructions: [
      "Place your index finger on your neck",
      "Slide your finger down length of your neck",
      "Keep your other hand relaxed at your side",
      "The motion should be smooth and deliberate",
      "Maintain a neutral facial expression"
    ],
    tips: [
      "This sign refers to neck area of the body",
      "Can be used to indicate neck pain or neck-related topics",
      "The downward motion clearly indicates the neck area"
    ],
    commonMistakes: [
      "Don't press too hard on your neck - be gentle",
      "Keep your finger straight, not bent",
      "The motion should be downward, not sideways"
    ]
  },
  'SHOULDER': {
    category: 'body',
    instructions: [
      "Tap your right shoulder with your left hand",
      "Or tap your left shoulder with your right hand",
      "Use a quick, clear tapping motion",
      "Keep your fingers together when tapping",
      "The tap should be firm but not painful"
    ],
    tips: [
      "This sign indicates the shoulder area",
      "Can be used for either left or right shoulder",
      "Common in conversations about body parts or pain"
    ],
    commonMistakes: [
      "Don't slap your shoulder - use a gentle tap",
      "Keep your hand relaxed, not stiff",
      "Tap once, not multiple times"
    ]
  },
  'HELP': {
    category: 'manners',
    instructions: [
      "Place your left fist on your left palm",
      "Raise both hands to chest level",
      "Lift both hands upward together",
      "The motion shows lifting someone up",
      "Keep a concerned or helpful facial expression"
    ],
    tips: [
      "This sign is used when someone needs assistance",
      "Can be used to ask for help or offer help",
      "The upward motion represents supporting someone"
    ],
    commonMistakes: [
      "Don't separate your hands - keep them together",
      "The motion should be upward, not sideways",
      "Keep your fists closed, not open hands"
    ]
  },
  'SORRY': {
    category: 'manners',
    instructions: [
      "Make a fist with your right hand",
      "Place your fist over your heart",
      "Make a circular motion over your heart",
      "The motion shows feeling sorry in your heart",
      "Keep a sincere and apologetic facial expression"
    ],
    tips: [
      "This sign is used to apologize or express regret",
      "The circular motion represents feeling sorry",
      "Can be used for minor mistakes or serious apologies"
    ],
    commonMistakes: [
      "Don't tap too hard - be gentle over your heart",
      "Keep the motion circular, not straight lines",
      "Your fist should stay over your heart area"
    ]
  }
};

// ─── Chat Functions ─────────────────────────────────────────────────────
function sendCoachMessage() {
  const input = document.getElementById('coachInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message to chat
  addChatMessage(message, 'user');
  input.value = '';
  
  // Process the message and respond
  setTimeout(() => {
    const response = generateCoachResponse(message);
    addChatMessage(response.text, 'coach', response.actions);
  }, 500);
}

function handleCoachInputKeypress(event) {
  if (event.key === 'Enter') {
    sendCoachMessage();
  }
}

function addChatMessage(text, sender, actions = []) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-msg`;
  
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = sender === 'coach' ? '🤖' : '👤';
  
  const content = document.createElement('div');
  content.className = 'msg-content';
  
  // Parse text for sign names and create practice buttons
  const processedText = processSignNames(text, actions);
  content.innerHTML = processedText;
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(content);
  messagesContainer.appendChild(messageDiv);
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function processSignNames(text, actions) {
  let processedText = text;
  
  // Highlight sign names and add practice buttons
  Object.keys(signKnowledgeBase).forEach(signName => {
    const regex = new RegExp(`\\b${signName}\\b`, 'gi');
    if (regex.test(text)) {
      processedText = processedText.replace(regex, 
        `<strong>${signName}</strong> <button class="sign-practice-btn" onclick="practiceSign('${signName}')">Practice</button>`
      );
    }
  });
  
  // Add action buttons if provided
  if (actions && actions.length > 0) {
    processedText += '<div style="margin-top: 12px;">';
    actions.forEach(action => {
      if (action.type === 'practice') {
        processedText += `<button class="sign-practice-btn" onclick="practiceSign('${action.sign}')">Practice ${action.sign}</button>`;
      }
    });
    processedText += '</div>';
  }
  
  return processedText.replace(/\n/g, '<br>');
}

function generateCoachResponse(userMessage) {
  const message = userMessage.toLowerCase();
  
  // Check for specific sign requests
  for (const signName of Object.keys(signKnowledgeBase)) {
    if (message.includes(signName.toLowerCase()) || 
        message.includes(`sign ${signName.toLowerCase()}`) ||
        message.includes(`how to ${signName.toLowerCase()}`)) {
      return teachSign(signName);
    }
  }
  
  // Check for category requests
  if (message.includes('daily') || message.includes('everyday')) {
    return suggestDailySigns();
  }
  
  if (message.includes('greeting') || message.includes('hello') || message.includes('hi')) {
    return suggestGreetings();
  }
  
  if (message.includes('manner') || message.includes('polite') || message.includes('thank') || message.includes('please')) {
    return suggestManners();
  }
  
  if (message.includes('help') || message.includes('assist')) {
    return provideHelp();
  }
  
  // Default response
  return {
    text: `I can help you learn ASL signs from your trained model! Try asking me about specific signs like "THANK YOU", "CONFUSED", "FRIEND", "NECK", "SHOULDER", or "SORRY". You can also ask for categories like "daily signs", "social", "manners", "emotions", or "body".\n\n**Available signs:** THANK YOU, CONFUSED, EYES AWAKE, FRIEND, PRETTY, RELAX, REMEMBER, NOTHING, NECK, SHOULDER, SORRY\n\nWhat specific sign would you like to learn today?`,
    actions: []
  };
}

function teachSign(signName) {
  const sign = signKnowledgeBase[signName];
  if (!sign) {
    return {
      text: `I don't have information about "${signName}" in my current knowledge base. Let me teach you a sign I know, like HELLO or THANK YOU.`,
      actions: []
    };
  }
  
  let response = `Great choice! Let me teach you how to sign **${signName}**.\n\n`;
  response += `**Category:** ${sign.category}\n\n`;
  response += `**Step-by-step instructions:**\n`;
  
  sign.instructions.forEach((instruction, index) => {
    response += `${index + 1}. ${instruction}\n`;
  });
  
  response += `\n**Pro tips:**\n`;
  sign.tips.forEach(tip => {
    response += `• ${tip}\n`;
  });
  
  response += `\n**Common mistakes to avoid:**\n`;
  sign.commonMistakes.forEach(mistake => {
    response += `• ${mistake}\n`;
  });
  
  response += `\nReady to practice? Click the Practice button above and I'll guide you through it with real-time feedback!`;
  
  return {
    text: response,
    actions: [{ type: 'practice', sign: signName }]
  };
}

function suggestDailySigns() {
  const dailySigns = ['THANK YOU', 'FRIEND', 'PRETTY', 'RELAX', 'REMEMBER', 'NOTHING', 'NECK', 'SHOULDER', 'SORRY'];
  let response = `Here are some essential daily signs from your trained model:\n\n`;
  
  dailySigns.forEach(sign => {
    response += `• **${sign}** - ${signKnowledgeBase[sign].category}\n`;
  });
  
  response += `\nWhich one would you like to practice first? Just tell me the sign name!`;
  
  return {
    text: response,
    actions: dailySigns.map(sign => ({ type: 'practice', sign }))
  };
}

function suggestGreetings() {
  const greetingSigns = ['FRIEND', 'PRETTY'];
  let response = `Here are some social signs from your trained model:\n\n`;
  
  greetingSigns.forEach(sign => {
    response += `• **${sign}** - ${signKnowledgeBase[sign].category}\n`;
  });
  
  response += `\nWhich social sign would you like to practice first?`;
  
  return {
    text: response,
    actions: greetingSigns.map(sign => ({ type: 'practice', sign }))
  };
}

function suggestManners() {
  const mannerSigns = ['THANK YOU'];
  let response = `Politeness signs are crucial for respectful communication:\n\n`;
  
  mannerSigns.forEach(sign => {
    response += `• **${sign}** - Shows ${sign === 'THANK YOU' ? 'gratitude' : 'politeness'}\n`;
  });
  
  response += `\nWhich manner sign would you like to practice?`;
  
  return {
    text: response,
    actions: mannerSigns.map(sign => ({ type: 'practice', sign }))
  };
}

function provideHelp() {
  return {
    text: `I'm here to help you learn ASL signs from your trained model! Here's how I can assist you:\n\n**📚 Learn Specific Signs:**\nAsk me about signs like "Teach me THANK YOU" or "Show me CONFUSED"\n\n**📂 Browse Categories:**\n• "daily signs" - Essential everyday vocabulary\n• "social" - Friend, pretty, etc.\n• "manners" - Thank you, sorry\n• "emotions" - Confused, etc.\n• "body" - Neck, shoulder, etc.\n\n**🎯 Practice Mode:**\nWhen you click a Practice button, I'll:\n• Start your camera for real-time feedback\n• Guide you through each step\n• Tell you when you're doing it correctly\n• Help you fix common mistakes\n\n**Available signs in your model:** THANK YOU, CONFUSED, EYES AWAKE, FRIEND, PRETTY, RELAX, REMEMBER, NOTHING, NECK, SHOULDER, SORRY\n\n**What would you like to learn first?**`,
    actions: []
  };
}

function quickRequest(type) {
  const input = document.getElementById('coachInput');
  
  switch(type) {
    case 'daily':
      input.value = 'Teach me daily conversation signs';
      break;
    case 'greetings':
      input.value = 'Show me greeting signs';
      break;
    case 'manners':
      input.value = 'Help me with polite signs';
      break;
    case 'help':
      input.value = 'How can you help me?';
      break;
  }
  
  sendCoachMessage();
}

// ─── Practice Functions ───────────────────────────────────────────────────
async function practiceSign(signName) {
  const sign = signKnowledgeBase[signName];
  if (!sign) {
    toast(`Sign "${signName}" not found in knowledge base`, '⚠️');
    return;
  }
  
  coachState.currentSign = signName;
  coachState.practiceMode = true;
  
  // Update practice UI
  document.getElementById('currentPracticeSign').textContent = signName;
  document.getElementById('recognitionStatus').textContent = 'Get ready...';
  document.getElementById('practiceConfidence').style.width = '0%';
  
  // Display instructions with video
  let instructionText = `<strong>Practicing: ${signName}</strong><br><br>`;
  sign.instructions.forEach((instruction, index) => {
    instructionText += `${index + 1}. ${instruction}<br>`;
  });
  
  // Add tips section
  instructionText += `<br><strong>💡 Pro Tips:</strong><br>`;
  sign.tips.forEach(tip => {
    instructionText += `• ${tip}<br>`;
  });
  
  document.getElementById('instructionText').innerHTML = instructionText;
  
  // Load and display video tutorial
  await loadTutorialVideo(signName);
  
  // Start camera if not already running
  if (!coachState.practiceCamera) {
    await startPracticeCam();
  }
  
  // Focus on coach tab
  nav('coach');
  
  toast(`Now practicing ${signName}! Watch the video and follow instructions.`, '🎯');
}

async function startPracticeCam() {
  try {
    // Reset and reinitialize hands for clean start
    if (coachState.practiceHands) {
      coachState.practiceHands.close();
      coachState.practiceHands = null;
    }
    
    coachState.practiceHands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
    });
    coachState.practiceHands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.55,
    });
    coachState.practiceHands.onResults(onPracticeResults);

    const video = document.getElementById('practiceVid');
    coachState.practiceCamera = new Camera(video, {
      onFrame: async () => {
        if (coachState.practiceMode) await coachState.practiceHands.send({ image: video });
      },
      width: 640,
      height: 480,
    });

    await coachState.practiceCamera.start();
    
    // Update UI
    document.getElementById('practiceVid').style.display = 'block';
    document.getElementById('practiceCanvas').style.display = 'block';
    document.getElementById('practicePlaceholder').style.display = 'none';
    document.getElementById('btnStartPractice').style.display = 'none';
    document.getElementById('btnStopPractice').style.display = 'inline-flex';
    
    toast('Practice camera started! Show your sign to get feedback.', '📸');
  } catch (err) {
    toast('Camera error: ' + err.message, '❌');
  }
}

async function loadTutorialVideo(signName) {
  const videoContainer = document.getElementById('instructionVideo');
  const videoElement = document.getElementById('tutorialVideo');
  
  try {
    // Try to load the video from media/gloss_videos/
    const videoUrl = `media/gloss_videos/${signName}.mp4`;
    
    // Test if video exists by trying to load it
    const testVideo = document.createElement('video');
    testVideo.src = videoUrl;
    
    return new Promise((resolve) => {
      testVideo.onloadeddata = () => {
        // Video exists and can be loaded
        videoElement.src = videoUrl;
        videoContainer.style.display = 'block';
        videoElement.play().catch(e => {
          // Autoplay might be blocked, that's okay
        });
        resolve(true);
      };
      
      testVideo.onerror = () => {
        // Video doesn't exist or can't be loaded
        videoContainer.style.display = 'none';
        resolve(false);
      };
    });
    
  } catch (error) {
    videoContainer.style.display = 'none';
    return false;
  }
}

function stopPracticeCam() {
  if (coachState.practiceCamera) {
    coachState.practiceCamera.stop();
    coachState.practiceMode = false;
  }
  
  // Clean up hands properly
  if (coachState.practiceHands) {
    coachState.practiceHands.close();
    coachState.practiceHands = null;
  }

  document.getElementById('practiceVid').style.display = 'none';
  document.getElementById('practiceCanvas').style.display = 'none';
  document.getElementById('practicePlaceholder').style.display = 'flex';
  document.getElementById('btnStartPractice').style.display = 'inline-flex';
  document.getElementById('btnStopPractice').style.display = 'none';
  
  // Reset feedback
  document.getElementById('currentPracticeSign').textContent = 'None';
  document.getElementById('recognitionStatus').textContent = 'Waiting...';
  document.getElementById('practiceConfidence').style.width = '0%';
  
  // Hide video
  document.getElementById('instructionVideo').style.display = 'none';
  const videoElement = document.getElementById('tutorialVideo');
  videoElement.pause();
  videoElement.src = '';
  
  // Reset practice state
  coachState.currentSign = null;
  coachState.lastFeedback = null;
  coachState.perfectFreezeUntil = 0; // Reset freeze timer
  coachState.lastMotion = null; // Reset motion tracking
  coachState.prevLandmarks = []; // Clear previous landmarks
  
  toast('Practice camera stopped.', '⏹️');
}

function onPracticeResults(results) {
  const canvas = document.getElementById('practiceCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = results.image.width;
  canvas.height = results.image.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = results.multiHandLandmarks;
  // Check if we should freeze the perfect status
  const now = Date.now();
  if (coachState.perfectFreezeUntil > now) {
    // Keep showing perfect status during freeze period
    const timeRemaining = Math.ceil((coachState.perfectFreezeUntil - now) / 1000);
    document.getElementById('recognitionStatus').textContent = `✅ Perfect! (${timeRemaining}s)`;
    return; // Skip further processing during freeze
  }
  
  // Normal recognition processing
  if (!landmarks || !landmarks.length) {
    document.getElementById('recognitionStatus').textContent = 'No hand detected';
    document.getElementById('practiceConfidence').style.width = '0%';
    return;
  }

  // Draw all detected hands
  for (let hi = 0; hi < landmarks.length; hi++) {
    drawHand(ctx, landmarks[hi], canvas.width, canvas.height, hi);
  }
  
  // Calculate motion for enhanced recognition
  if (landmarks.length > 0) {
    const motion = calculatePracticeMotion(landmarks[0]);
    coachState.lastMotion = motion;
  }

  // Check for sign recognition if we're practicing
  if (coachState.currentSign && window.mlPredictSignSync) {
    // Test each detected hand and use the best match
    let bestHit = null;
    let bestConfidence = 0;
    
    for (let hi = 0; hi < landmarks.length; hi++) {
      const hit = window.mlPredictSignSync(landmarks[hi]);
      if (hit && hit.conf > bestConfidence) {
        bestHit = hit;
        bestConfidence = hit.conf;
      }
    }
    
    if (bestHit) {
      const confidence = bestHit.conf;
      const recognizedSign = bestHit.sign.name;
      
      // Special handling for EYES AWAKE sign - enhance confidence with motion detection
      if (recognizedSign === 'EYES AWAKE' && coachState.currentSign === 'EYES AWAKE') {
        // Check for characteristic upward motion (eyes opening)
        if (coachState.lastMotion && coachState.lastMotion.type === 'linear' && 
            coachState.lastMotion.direction === 'up' && coachState.lastMotion.intensity > 0.02) {
          bestHit.conf = Math.min(1.0, bestHit.conf + 0.25); // Significant boost for proper EYES AWAKE motion
        } else if (coachState.lastMotion && coachState.lastMotion.intensity < 0.01) {
          bestHit.conf = Math.max(0, bestHit.conf - 0.15); // Reduce confidence for static hands
        }
      }
      
      // Update confidence bar
      document.getElementById('practiceConfidence').style.width = Math.round(confidence * 100) + '%';
      
      // Enhanced sign verification with stricter thresholds
      const isCorrectSign = recognizedSign === coachState.currentSign;
      
      // Special threshold for EYES AWAKE - easier to achieve perfect
      let highConfidence = confidence > 0.75;
      let mediumConfidence = confidence > 0.5;
      
      if (coachState.currentSign === 'EYES AWAKE') {
        // Lower thresholds for EYES AWAKE to make perfect easier
        highConfidence = confidence > 0.55; // Perfect at 55% instead of 75%
        mediumConfidence = confidence > 0.35; // Close at 35% instead of 50%
      }
      
      if (isCorrectSign && highConfidence) {
        // Perfect recognition - freeze status and output sign like Live mode
        const now = Date.now();
        coachState.perfectFreezeUntil = now + 3000; // Freeze for 3 seconds
        
        document.getElementById('recognitionStatus').textContent = '✅ Perfect!';
        document.getElementById('recognitionStatus').style.color = 'var(--a5)';
        
        // Add visual freeze effect
        document.getElementById('recognitionStatus').style.animation = 'pulse 0.5s ease-in-out 3';
        
        // Add sign to sentence builder like Live mode
        if (typeof addToSentence === 'function') {
          addToSentence(recognizedSign);
          showKinetic(recognizedSign);
        }
        
        // Provide positive feedback
        if (!coachState.lastFeedback || coachState.lastFeedback !== 'perfect') {
          providePositiveFeedback();
          coachState.lastFeedback = 'perfect';
        }
        
        // Clear current practice after successful recognition
        setTimeout(() => {
          coachState.currentSign = null;
          document.getElementById('currentPracticeSign').textContent = 'Ready for next sign';
        }, 2000);
      } else if (isCorrectSign && mediumConfidence) {
        // Getting close
        document.getElementById('recognitionStatus').textContent = '👍 Getting close!';
        document.getElementById('recognitionStatus').style.color = 'var(--a4)';
        
        if (!coachState.lastFeedback || coachState.lastFeedback !== 'close') {
          provideCloseFeedback();
          coachState.lastFeedback = 'close';
        }
      } else if (isCorrectSign) {
        // Low confidence but correct sign
        document.getElementById('recognitionStatus').textContent = '🤔 Almost there';
        document.getElementById('recognitionStatus').style.color = 'var(--a3)';
        
        if (!coachState.lastFeedback || coachState.lastFeedback !== 'almost') {
          provideAlmostThereFeedback();
          coachState.lastFeedback = 'almost';
        }
      } else {
        // Wrong sign detected
        document.getElementById('recognitionStatus').textContent = `❌ ${recognizedSign}`;
        document.getElementById('recognitionStatus').style.color = 'var(--a1)';
        
        // Provide corrective feedback
        if (!coachState.lastFeedback || coachState.lastFeedback !== 'corrective') {
          provideCorrectiveFeedback(recognizedSign, confidence);
          coachState.lastFeedback = 'corrective';
        }
      }
      
      // Update recognition history for better feedback
      coachState.recognitionHistory.push({
        sign: recognizedSign,
        confidence: confidence,
        timestamp: Date.now(),
        isCorrect: isCorrectSign
      });
      
      // Keep only recent history
      if (coachState.recognitionHistory.length > 10) {
        coachState.recognitionHistory.shift();
      }
    }
  }
}

function providePositiveFeedback() {
  const messages = [
    "Excellent! You're doing that sign perfectly!",
    "Great job! Your hand position and movement are spot on.",
    "Perfect! Keep practicing to build muscle memory.",
    "Wonderful! You've mastered that sign.",
    "Fantastic! Your form is excellent."
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  toast(message, '🎉');
  
  // Add success message to chat
  setTimeout(() => {
    addChatMessage(`🎉 ${message} You've successfully mastered ${coachState.currentSign}!`, 'coach');
  }, 1000);
}

function provideCloseFeedback() {
  const messages = [
    "Good! You're very close to the correct sign.",
    "Nice work! Just a small adjustment needed.",
    "Almost there! Focus on your hand position.",
    "Great progress! Check your finger placement.",
    "Keep going! You're nearly there."
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  toast(message, '👍');
}

function provideAlmostThereFeedback() {
  const messages = [
    "I can see you're trying! Try to be more precise.",
    "Good attempt! Focus on the exact hand shape.",
    "Keep practicing! Your form is developing.",
    "Nice try! Pay attention to the details.",
    "Don't give up! You're making progress."
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  toast(message, '💪');
}

function calculatePracticeMotion(landmarks) {
  // Simple motion detection for practice mode
  if (!coachState.prevLandmarks || coachState.prevLandmarks.length === 0) {
    coachState.prevLandmarks = landmarks.map(lm => ({ ...lm }));
    return { type: 'static', intensity: 0, direction: 'none' };
  }
  
  let totalDx = 0, totalDy = 0;
  const numPoints = landmarks.length;
  
  for (let i = 0; i < numPoints; i++) {
    const curr = landmarks[i];
    const prev = coachState.prevLandmarks[i];
    totalDx += curr.x - prev.x;
    totalDy += curr.y - prev.y;
  }
  
  const avgDx = totalDx / numPoints;
  const avgDy = totalDy / numPoints;
  const intensity = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
  
  // Update previous landmarks
  coachState.prevLandmarks = landmarks.map(lm => ({ ...lm }));
  
  if (intensity < 0.01) {
    return { type: 'static', intensity: 0, direction: 'none' };
  }
  
  let direction = 'none';
  if (Math.abs(avgDx) > Math.abs(avgDy)) {
    direction = avgDx > 0 ? 'right' : 'left';
  } else {
    direction = avgDy > 0 ? 'down' : 'up';
  }
  
  return { type: 'linear', intensity, direction };
}

function provideCorrectiveFeedback(detectedSign, confidence) {
  const currentSign = coachState.currentSign;
  const sign = signKnowledgeBase[currentSign];
  
  // Analyze common confusion patterns
  const confusionMap = {
    'THANK YOU': ['CONFUSED', 'RELAX'],
    'CONFUSED': ['THANK YOU', 'REMEMBER'],
    'EYES AWAKE': ['CONFUSED', 'PRETTY'],
    'FRIEND': ['PRETTY', 'THANK YOU'],
    'PRETTY': ['FRIEND', 'EYES AWAKE'],
    'RELAX': ['THANK YOU', 'NOTHING'],
    'REMEMBER': ['CONFUSED', 'RELAX'],
    'NOTHING': ['RELAX', 'CONFUSED'],
    'NECK': ['SHOULDER', 'CONFUSED'],
    'SHOULDER': ['NECK', 'FRIEND']
  };
  
  let feedbackMessage = `I detected "${detectedSign}" instead of "${currentSign}". `;
  
  // Check if this is a common confusion
  if (confusionMap[currentSign] && confusionMap[currentSign].includes(detectedSign)) {
    feedbackMessage += `This is a common confusion! `;
  }
  
  if (sign && sign.commonMistakes && sign.commonMistakes.length > 0) {
    const mistake = sign.commonMistakes[0];
    feedbackMessage += `Tip: ${mistake}`;
    
    setTimeout(() => {
      toast(`Tip: ${mistake}`, '💡');
    }, 1000);
  } else {
    feedbackMessage += "Keep practicing and follow the step-by-step instructions.";
  }
  
  // Add specific guidance based on detected sign
  if (confidence < 0.3) {
    feedbackMessage += " Try to make your sign clearer and more deliberate.";
  }
  
  // Add feedback to chat
  setTimeout(() => {
    addChatMessage(`🔍 ${feedbackMessage}`, 'coach');
  }, 500);
}

// ─── Initialize Coach ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Add coach to navigation if function exists
  if (typeof window.nav === 'function') {
    // Coach page is already in HTML, no need to add dynamically
  }
});

// Export functions for global access
window.practiceSign = practiceSign;
window.startPracticeCam = startPracticeCam;
window.stopPracticeCam = stopPracticeCam;
window.sendCoachMessage = sendCoachMessage;
window.handleCoachInputKeypress = handleCoachInputKeypress;
window.quickRequest = quickRequest;
