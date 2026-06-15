/*
 * prctl-pdeathsig — Linux helper that sets PR_SET_PDEATHSIG to SIGKILL,
 * then exec's the remaining arguments.
 *
 * Usage: prctl-pdeathsig <command> [args...]
 *
 * Build: gcc -o bin/prctl-pdeathsig bin/prctl-pdeathsig.c
 *
 * PR_SET_PDEATHSIG (value 1) tells the kernel to send the specified signal
 * to the calling process when its parent dies. This is the most reliable
 * way to ensure no zombie/detached children survive an agent crash.
 */
#include <sys/prctl.h>
#include <signal.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
    if (argc < 2) {
        return 1;
    }
    /* Ask kernel to send SIGKILL when parent dies */
    prctl(PR_SET_PDEATHSIG, SIGKILL);
    /* Exec the real command, replacing this process */
    execvp(argv[1], argv + 1);
    /* If exec fails, just exit */
    return 127;
}
