#include <stdio.h>
#include <string.h>
int main() {
    char gram[100], part1[50], part2[50], modifiedGram[50], newGram[50];
    int i, j = 0, k = 0, pos = 0;
    printf("Enter Production : A->");
    if (fgets(gram, sizeof(gram), stdin) == NULL) {
        printf("Error reading input.\n");
        return 1;
    }
    gram[strcspn(gram, "\n")] = '\0';
    char *pipe_pos = strchr(gram, '|');
    if (pipe_pos == NULL) {
        printf("No '|' found in production.\n");
        return 1;
    }
    int pipe_index = pipe_pos - gram;
    strncpy(part1, gram, pipe_index);
    part1[pipe_index] = '\0';
    strcpy(part2, gram + pipe_index + 1);
    for (i = 0; i < (int)strlen(part1) && i < (int)strlen(part2); i++) {
        if (part1[i] == part2[i]) {
            modifiedGram[k++] = part1[i];
            pos = i + 1;
        } else {
            break;
        }
    }
    modifiedGram[k++] = 'X';  // New non-terminal
    modifiedGram[k] = '\0';
    j = 0;
    for (i = pos; i < (int)strlen(part1); i++) {
        newGram[j++] = part1[i];
    }
    newGram[j++] = '|';
    for (i = pos; i < (int)strlen(part2); i++) {
        newGram[j++] = part2[i];
    }
    newGram[j] = '\0';
    printf("\nA->%s\n", modifiedGram);
    printf("X->%s\n", newGram);
    return 0;
}