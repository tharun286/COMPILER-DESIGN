#include <stdio.h>
#include <string.h>
#include <stdlib.h>
char s[50], stack[50];
int main() {
    char m[5][6][5] = {
        {"tb",   "",     "",     "tb",   "",     ""},    // E
        {"",     "+tb",  "",     "",     "n",    "n"},   // B
        {"fc",   "",     "",     "fc",   "",     ""},    // T
        {"",     "n",    "*fc",  "n",    "n",    "n"},   // C
        {"i",    "",     "",     "(e)",  "",     ""}     // F
    };
    int size[5][6] = {
        {2,0,0,2,0,0},
        {0,3,0,0,1,1},
        {2,0,0,2,0,0},
        {0,1,3,1,1,1},
        {1,0,0,3,0,0}
    };
    int i = 1, j = 0, k, n, str1 = 0, str2 = 0;
    printf("\nEnter the input string (only i,+,*,(,) allowed): ");
    scanf("%s", s);
    strcat(s, "$");
    n = strlen(s);
    stack[0] = '$';
    stack[1] = 'e';
    printf("\nStack\tInput\n");
    printf("____________________\n");
    while (stack[i] != '$' && s[j] != '$') {
        if (stack[i] == s[j]) {  // Terminal match
            i--;
            j++;
        }
        switch (stack[i]) {
            case 'e': str1 = 0; break;
            case 'b': str1 = 1; break;
            case 't': str1 = 2; break;
            case 'c': str1 = 3; break;
            case 'f': str1 = 4; break;
            default: str1 = -1; break;
        }
        switch (s[j]) {
            case 'i': str2 = 0; break;
            case '+': str2 = 1; break;
            case '*': str2 = 2; break;
            case '(': str2 = 3; break;
            case ')': str2 = 4; break;
            case '$': str2 = 5; break;
            default: str2 = -1; break;
        }
        if (str1 == -1 || str2 == -1 || m[str1][str2][0] == '\0') {
            printf("\nERROR: Invalid string\n");
            exit(0);
        } else if (m[str1][str2][0] == 'n') {  // ε-production
            i--;
        } else {  // Expand production
            i--; // Pop non-terminal
            for (k = size[str1][str2] - 1; k >= 0; k--) {
                stack[++i] = m[str1][str2][k];
            }
        }
        for (k = 0; k <= i; k++) printf("%c", stack[k]);
        printf("\t");
        for (k = j; k < n; k++) printf("%c", s[k]);
        printf("\n");
    }
        printf("\nSUCCESS: String parsed successfully!\n");
    return 0;
}