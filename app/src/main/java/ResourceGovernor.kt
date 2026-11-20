package com.nexuscore.ai.core

import android.os.Handler
import android.os.HandlerThread
import android.os.Process

/**
 * Cooperative task governor for work submitted through this class.
 * It cannot cap the entire Android process or other native/system threads.
 */
class ResourceGovernor(
    private val budgetPercent: Double = CPU_BUDGET_PERCENT
) {
    companion object {
        const val CPU_BUDGET_PERCENT = 35.0
    }

    private val workerThread = HandlerThread("NexusCore-Worker", Process.THREAD_PRIORITY_BACKGROUND).apply { start() }
    private val worker = Handler(workerThread.looper)
    @Volatile private var measuredProcessCpu = 0.0
    @Volatile private var closed = false

    fun updateMeasuredCpu(value: Double) {
        measuredProcessCpu = value.coerceIn(0.0, 100.0)
    }

    /** Submit only short, non-critical background tasks. */
    fun submit(task: () -> Unit) {
        if (closed) return
        worker.post { runWhenBudgetAllows(task) }
    }

    private fun runWhenBudgetAllows(task: () -> Unit) {
        if (closed) return
        if (measuredProcessCpu >= budgetPercent) {
            worker.postDelayed({ runWhenBudgetAllows(task) }, 250L)
            return
        }
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
            task()
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (_: Exception) {
            // Individual background tasks must fail closed; callers should log their own errors.
        }
    }

    fun close() {
        closed = true
        worker.removeCallbacksAndMessages(null)
        workerThread.quitSafely()
    }
}
