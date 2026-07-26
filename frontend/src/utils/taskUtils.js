/**
 * Derives task states and execution steps from conversation messages
 * and active task socket status.
 *
 * @param {Array} messages - The list of messages in the conversation
 * @param {boolean} isThinking - Socket thinking state
 * @param {boolean} isSpeaking - Socket speaking state
 * @param {string} activeStatus - The current socket status
 * @returns {Array} The derived tasks
 */
export function deriveTasksFromMessages(messages, isThinking, isSpeaking, activeStatus) {
  const tasks = [];
  let currentTask = null;

  messages.forEach((msg, index) => {
    if (msg.role === 'user') {
      if (currentTask) {
        currentTask.status = 'completed';
        tasks.push(currentTask);
      }
      currentTask = {
        id: `task-${index}`,
        command: msg.text,
        status: 'completed',
        steps: [],
        result: ''
      };
    } else if ((msg.role === 'assistant' || msg.role === 'agent') && currentTask) {
      currentTask.steps = [];
      currentTask.result = '';
      const lines = msg.text.split('\n');
      lines.forEach((line) => {
        if (line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
          currentTask.steps.push({ text: line.replace(/^[-*\d.\s]+/, '').trim(), status: 'completed' });
        } else {
          currentTask.result = (currentTask.result ? currentTask.result + '\n' : '') + line;
        }
      });
    }
  });

  if (currentTask) {
    tasks.push(currentTask);
  }

  if (tasks.length > 0) {
    const lastTask = tasks[tasks.length - 1];
    
    // Direct mapping from activeStatus to task status:
    // cancelled -> 'cancelled', cancelling -> 'cancelling', done -> 'completed', failed -> 'failed', else -> 'running'
    if (activeStatus === 'cancelled') {
      lastTask.status = 'cancelled';
    } else if (activeStatus === 'cancelling') {
      lastTask.status = 'cancelling';
    } else if (activeStatus === 'failed') {
      lastTask.status = 'failed';
    } else if (activeStatus === 'done' && !isSpeaking) {
      lastTask.status = 'completed';
    } else if (activeStatus === 'idle') {
      lastTask.status = 'completed';
    } else {
      lastTask.status = 'running';
    }
    
    return [lastTask];
  }

  return [];
}
