%{
#include <stdio.h>
int vc = 0;
extern FILE *yyin;
%}

%%
[aeiouAEIOU] { vc++; }
.|\n        { /* skip others */ }
%%

int main(int argc, char *argv[]) {
    if (argc != 2) {
        printf("Usage: ./countvowels <inputfile>\n");
        return 1;
    }

    yyin = fopen(argv[1], "r");
    if (!yyin) {
        perror("Error opening file");
        return 1;
    }

    yylex();
    printf("Number of vowels = %d\n", vc);
    return 0;
}

