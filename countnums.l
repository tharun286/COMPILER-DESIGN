%{
#include <stdio.h>
#include <stdlib.h>

int posint = 0, negint = 0, posfraction = 0, negfraction = 0;
%}

%%
[-][0-9]+                { negint++; }
[+]?[0-9]+\.[0-9]+       { posfraction++; }
[-][0-9]+\.[0-9]+        { negfraction++; }
[+]?[0-9]+               { posint++; }
%%

int yywrap() {
    return 1;
}

int main(int argc, char *argv[]) {
    FILE *yyin;

    if (argc != 2) {
        printf("Usage: ./a.out <inputfile>\n");
        exit(1);
    }

    yyin = fopen(argv[1], "r");
    if (!yyin) {
        perror("File open error");
        exit(1);
    }

    yylex();
    printf("No of +ve integers = %d\n", posint);
    printf("No of -ve integers = %d\n", negint);
    printf("No of +ve fractions = %d\n", posfraction);
    printf("No of -ve fractions = %d\n", negfraction);

    fclose(yyin);
    return 0;
}

